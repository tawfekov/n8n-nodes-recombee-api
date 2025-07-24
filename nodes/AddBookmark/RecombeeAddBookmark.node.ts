import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeOperationError,
	NodeConnectionTypes,
} from 'n8n-workflow';
import { ApiClient as RecombeeClient, requests } from 'recombee-api-client';
import { toEpochTimestamp } from '../Utils/timestamp';

export class RecombeeAddBookmark implements INodeType {
	description: INodeTypeDescription = {
		usableAsTool: true,
		displayName: 'Recombee AddBookmark',
		name: 'recombeeAddBookmark',
		icon: 'file:../RecombeeNode.svg',
		group: ['transform'],
		version: 1,
		description: 'Records when a user bookmarks an item. Bookmarks indicate strong user interest and help improve recommendation accuracy. This operation is useful for tracking saved or favorited items',
		defaults: {
			name: 'AddBookmark',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'recombeeCredentialsApi', required: true }],
		properties: [
			{
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				default: '',
				required: true,
				description: 'The ID of the user who bookmarked the item',
			},
			{
				displayName: 'Item ID',
				name: 'itemId',
				type: 'string',
				default: '',
				required: true,
				description: 'The ID of the item that was bookmarked',
			},
			{
				displayName: 'Cascade Create',
				name: 'cascadeCreate',
				type: 'boolean',
				default: false,
				required: true,
				description: 'Whether to create the item if it does not exist',
			},
			{
				displayName: 'Timestamp',
				name: 'timestamp',
				type: 'dateTime',
				default: '',
				description: 'Optional timestamp of when the bookmark was created. If not provided, the current time will be used.',
			},
			{
				displayName: 'Max Retries',
				name: 'maxRetries',
				type: 'number',
				default: 2,
				description: 'Number of times to retry failed batch requests. Useful for handling temporary network issues or rate limits.',
			},
			{
				displayName: 'Recommendation ID',
				name: 'recommId',
				type: 'string',
				default: '',
				description: 'Optional recommendation ID. If provided, the bookmark will be associated with the specified recommendation.',
			}
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('recombeeCredentialsApi');

		const timeout = Number.isFinite(parseInt(credentials.recombee_api_timeout.toString()))
			? parseInt(credentials.recombee_api_timeout.toString())
			: 10000;

		const client = new RecombeeClient(
			credentials.recombee_database_id.toString(),
			credentials.recombee_database_private_token.toString(),
			{ region: credentials.recombee_database_region.toString() },
		);

		const maxRetries = this.getNodeParameter('maxRetries', 0) as number;

		let batchRequests: requests.Request[] = [];
		const processedItems: { userId: string; itemId: string; recommId: string; index: number, cascadeCreate: boolean, timestamp: string }[] = [];

		const sendBatchWithRetry = async (batch: requests.Request[], itemsMeta: any[]) => {
			let attempts = 0;
			let responses;
			while (attempts <= maxRetries) {
				try {
					responses = await client.send(new requests.Batch(batch));
					break;
				} catch (err) {
					attempts++;
					if (attempts > maxRetries) throw err;
				}
			}
			responses?.forEach((res: any, idx: number) => {
				if (res.error) {
					if (this.continueOnFail()) {
						returnData.push({ json: { success: false, error: res.error, ...itemsMeta[idx] }, pairedItem: itemsMeta[idx].index });
					} else {
						throw new NodeOperationError(this.getNode(), res.error);
					}
				} else {
					returnData.push({ json: { success: true, ...itemsMeta[idx], data: res } });
				}
			});
		};

		try {
			for (let i = 0; i < items.length; i++) {
				const itemId = this.getNodeParameter('itemId', i) as string;
				const userId = this.getNodeParameter('userId', i) as string;
				const recommId = this.getNodeParameter('recommId', i) as string || '';
				const cascadeCreate: boolean = this.getNodeParameter('cascadeCreate', i) as boolean || false;
				const timestampValue = this.getNodeParameter('timestamp', i);
				const timestamp = toEpochTimestamp(timestampValue);
				const request = new requests.AddBookmark(userId, itemId, { recommId, cascadeCreate, timestamp });
				request.timeout = timeout;
				batchRequests.push(request);
				processedItems.push({ userId, itemId, recommId, index: i, cascadeCreate, timestamp });

				if (batchRequests.length >= 100) {
					await sendBatchWithRetry(batchRequests, processedItems);
					batchRequests = [];
					processedItems.length = 0;
				}
			}

			if (batchRequests.length > 0) {
				await sendBatchWithRetry(batchRequests, processedItems);
			}
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({ json: { success: false, error: error.message } });
			} else {
				throw error;
			}
		}

		return [returnData];
	}
}

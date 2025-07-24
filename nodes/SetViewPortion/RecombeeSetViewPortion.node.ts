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

export class RecombeeSetViewPortion implements INodeType {
	description: INodeTypeDescription = {
		usableAsTool: true,
		displayName: 'Recombee SetViewPortion',
		name: 'recombeeSetViewPortion',
		icon: 'file:../RecombeeNode.svg',
		group: ['transform'],
		version: 1,
		description: 'Sets viewed portion of an item (for example a video or article) by a user (at a session). If you send a new request with the same (userId, itemId, sessionId), the portion gets updated.',
		defaults: {
			name: 'SetViewPortion',
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
				description: 'The ID of the user to update',
			},
			{
				displayName: 'Item ID',
				name: 'itemId',
				type: 'string',
				default: '',
				required: true,
				description: 'The ID of the item to update',
			},
			{
				displayName: 'Portion',
				name: 'portion',
				type: 'number',
				default: 0,
				required: true,
				description: 'The portion viewed of the item to update',
			},
			{
				displayName: 'Session ID',
				name: 'sessionId',
				type: 'string',
				default: '',
				required: true,
				description: 'The ID of the session to update',
			},
			{
				displayName: 'Timestamp',
				name: 'timestamp',
				type: 'dateTime',
				default: '',
				description: 'Optional timestamp of when the view occurred. If not provided, the current time will be used.',
			},
			{
				displayName: 'Cascade Create',
				name: 'cascadeCreate',
				type: 'boolean',
				default: true,
				required: true,
				description: 'Whether to create the user if it does not exist',
			},
			{
				displayName: 'Recommendation ID',
				name: 'recommId',
				type: 'string',
				default: '',
				description: 'Optional recommendation ID. If provided, the portion view value will be associated with the specified recommendation.',
			},
			{
				displayName: 'Additional Data',
				name: 'additionalData',
				type: 'json',
				default: '{}',
				required: true,
				description: 'JSON object containing additional data to set or update',
			},
			{
				displayName: 'Max Retries',
				name: 'maxRetries',
				type: 'number',
				default: 2,
				description: 'Number of times to retry failed batch requests. Useful for handling temporary network issues or rate limits.',
			},
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
		const processedItems: { userId: string; itemId: string; portion: number; sessionId: string; additionalData: Record<string, any>; cascadeCreate: boolean; recommId: string; timestamp: number; index: number }[] = [];

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
					returnData.push({ json: { success: true, ...itemsMeta[idx], userData: res } });
				}
			});
		};

		try {
			for (let i = 0; i < items.length; i++) {
				const userId = this.getNodeParameter('userId', i) as string;
				const itemId = this.getNodeParameter('itemId', i) as string;
				const portion = this.getNodeParameter('portion', i) as number;
				const sessionId = this.getNodeParameter('sessionId', i) as string;
				const additionalData = JSON.parse(this.getNodeParameter('additionalData', i) as string) as Record<string, any>;
				const cascadeCreate = this.getNodeParameter('cascadeCreate', i) as boolean || true;
				const recommId = this.getNodeParameter('recommId', i) as string || '';
				const timestampValue = this.getNodeParameter('timestamp', i);
				const timestamp = toEpochTimestamp(timestampValue);
				const request = new requests.SetViewPortion(userId, itemId, portion, {
					sessionId,
					cascadeCreate,
					recommId,
					timestamp,
					additionalData
				});
				request.timeout = timeout;
				batchRequests.push(request);
				processedItems.push({ userId, itemId, portion, sessionId, additionalData, cascadeCreate, recommId, timestamp, index: i });

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

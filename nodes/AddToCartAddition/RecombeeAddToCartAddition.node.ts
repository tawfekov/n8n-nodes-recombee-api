import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeOperationError,
	NodeConnectionTypes,
} from 'n8n-workflow';
import { ApiClient as RecombeeClient, requests } from 'recombee-api-client';

export class RecombeeAddToCartAddition implements INodeType {
	description: INodeTypeDescription = {
		usableAsTool: true,
		displayName: 'Recombee AddToCartAddition',
		name: 'recombeeAddToCartAddition',
		icon: 'file:../RecombeeNode.svg',
		group: ['transform'],
		version: 1,
		description: 'Records when a user adds an item to their shopping cart. Cart additions indicate purchase intent and help improve recommendation accuracy. This operation is essential for tracking shopping behavior',
		defaults: {
			name: 'AddToCartAddition',
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
				description: 'The ID of the user who added the item to cart',
			},
			{
				displayName: 'Item ID',
				name: 'itemId',
				type: 'string',
				default: '',
				required: true,
				description: 'The ID of the item that was added to cart',
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
				displayName: 'Amount',
				name: 'amount',
				type: 'number',
				default: 1,
				description: 'Optional amount of items added to cart. Default is 1.',
			},
			{
				displayName: 'Timestamp',
				name: 'timestamp',
				type: 'dateTime',
				default: '',
				description: 'Optional timestamp of when the item was added to cart. If not provided, the current time will be used.',
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
		const processedItems: { itemId: string; userId: string; amount: number; timestamp: string; index: number; cascadeCreate: boolean, recommId?: string }[] = [];

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
				const amount = this.getNodeParameter('amount', i) as number;
				const cascadeCreate: boolean = this.getNodeParameter('cascadeCreate', i) as boolean || false;
				const recommId = this.getNodeParameter('recommId', i) as string || ''
				const timestampValue = this.getNodeParameter('timestamp', i);
				let timestamp: string;
				if (typeof timestampValue === 'string' || typeof timestampValue === 'number') {
					const date = new Date(timestampValue);
					timestamp = isNaN(date.getTime()) ? new Date().getTime().toString() : date.getTime().toString();
				} else {
					timestamp = new Date().getTime().toString();
				}
				const request = new requests.AddCartAddition(userId, itemId, { amount, timestamp, cascadeCreate, recommId });
				request.timeout = timeout;
				batchRequests.push(request);
				processedItems.push({ itemId, userId, amount, timestamp, index: i, cascadeCreate, recommId });

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

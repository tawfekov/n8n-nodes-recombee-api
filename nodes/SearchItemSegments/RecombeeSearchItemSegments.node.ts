import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeOperationError,
	NodeConnectionTypes,
} from 'n8n-workflow';
import { ApiClient as RecombeeClient, requests } from 'recombee-api-client';

export class RecombeeSearchItemSegments implements INodeType {
	description: INodeTypeDescription = {
		usableAsTool: true,
		displayName: 'Recombee SearchItem Segments',
		name: 'recombeeSearchItemSegments',
		icon: 'file:../RecombeeNode.svg',
		group: ['transform'],
		version: 1,
		description: 'SearchItemSegments operation from Recombee',
		defaults: {
			name: 'SearchItem Segments',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'recombeeCredentialsApi', required: true }],
		properties: [
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
				required: true,
				description: 'The query to search for',
			},
			{
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				default: '',
				required: true,
				description: 'The ID of the user to search for',
			},
			{
				displayName: 'Count',
				name: 'count',
				type: 'number',
				default: 100,
				required: true,
				description: 'The number of items to return',
			},
			{
				displayName: 'Scenario',
				name: 'scenario',
				type: 'string',
				default: '',
				description: 'The scenario to search for',
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
				displayName: 'Filter',
				name: 'filter',
				type: 'string',
				default: '',
				description: 'The filter to apply to the search',
			},
			{
				displayName: 'Booster',
				name: 'booster',
				type: 'string',
				default: '',
				description: 'The booster to apply to the search',
			},
			{
				displayName: 'Logic',
				name: 'logic',
				type: 'json',
				default: '{}',
				description: 'The logic to apply to the search',
			},
			{
				displayName: 'Max Retries',
				name: 'maxRetries',
				type: 'number',
				default: 2,
				description: 'Number of times to retry failed batch requests',
			},
			{
				displayName: 'Timeout (Ms)',
				name: 'timeout',
				type: 'number',
				default: 10000,
				description: 'Request timeout in milliseconds',
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
		const processedItems: { userId: string; query: string; count: number; scenario: string; index: number; filter: string; booster: string; logic: Record<string, any> }[] = [];

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
					returnData.push({ json: { success: true, ...itemsMeta[idx], searchResult: res } });
				}
			});
		};

		try {
			for (let i = 0; i < items.length; i++) {
				const query = this.getNodeParameter('query', i) as string;
				if (query.length <= 0) {
					throw new NodeOperationError(this.getNode(), `Query can't be an empty string; you provided "${query}"`);
				}
				const userId = this.getNodeParameter('userId', i) as string;
				const count = this.getNodeParameter('count', i) as number;
				const scenario = this.getNodeParameter('scenario', i) as string;
				const cascadeCreate: boolean = this.getNodeParameter('cascadeCreate', i) as boolean || false;
				const filter = this.getNodeParameter('filter', i) as string;
				const booster = this.getNodeParameter('booster', i) as string;
				const logic = this.getNodeParameter('logic', i) as Record<string, any>;
				const request = new requests.SearchItemSegments(userId, query, count, { scenario, cascadeCreate, filter, booster, logic });
				request.timeout = timeout;
				batchRequests.push(request);
				processedItems.push({ userId, query, count, scenario, index: i, filter, booster, logic });

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

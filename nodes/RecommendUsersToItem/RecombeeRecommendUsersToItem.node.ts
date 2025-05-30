import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeOperationError,
	NodeConnectionType,
} from 'n8n-workflow';
import { ApiClient as RecombeeClient, requests } from 'recombee-api-client';

export class RecombeeRecommendUsersToItem implements INodeType {
	description: INodeTypeDescription = {
		usableAsTool: true,
		displayName: 'Recombee RecommendUsersToItem',
		name: 'recombeeRecommendUsersToItem',
		icon: 'file:../RecombeeNode.svg',
		group: ['transform'],
		version: 1,
		description: 'RecommendUsersToItem operation from Recombee with batching and retries',
		defaults: {
			name: 'Recommend Users To Item',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [{ name: 'recombeeCredentialsApi', required: true }],
		properties: [
			{ displayName: 'Item ID', name: 'itemId', type: 'string', default: '', required: true },
			{ displayName: 'Return Properties', name: 'returnProperties', type: 'boolean', default: true, required: true },
			{ displayName: 'Count', name: 'count', type: 'number', default: 100, required: true },
			{ displayName: 'Scenario', name: 'scenario', type: 'string', default: '', required: true },
			{ displayName: 'Batch Size', name: 'batchSize', type: 'number', default: 10, description: 'Number of requests per batch' },
			{ displayName: 'Max Retries', name: 'maxRetries', type: 'number', default: 2, description: 'Number of retry attempts on failure' },
			{ displayName: 'Timeout (Ms)', name: 'timeout', type: 'number', default: 10000, description: 'Request timeout in milliseconds' },
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('recombeeCredentialsApi');
		const maxRetries = this.getNodeParameter('maxRetries', 0) as number;
		const timeout = Number.isFinite(parseInt(credentials.recombee_api_timeout.toString()))
			? parseInt(credentials.recombee_api_timeout.toString())
			: 10000;
		const batchSize = this.getNodeParameter('batchSize', 0) as number;

		const client = new RecombeeClient(
			credentials.recombee_database_id.toString(),
			credentials.recombee_database_private_token.toString(),
			{ region: credentials.recombee_database_region.toString() },
		);

		const sendWithRetry = async (request: requests.Request, retries: number): Promise<any> => {
			let attempt = 0;
			while (attempt <= retries) {
				try {
					return await client.send(request);
				} catch (error) {
					if (attempt >= retries) throw error;
					attempt++;
				}
			}
		};

		for (let i = 0; i < items.length; i += batchSize) {
			const batchItems = items.slice(i, i + batchSize);
			const batchPromises = batchItems.map(async (item, index) => {
				const itemIndex = i + index;
				try {
					const itemId = this.getNodeParameter('itemId', itemIndex) as string;
					const count = this.getNodeParameter('count', itemIndex) as number;
					const scenario = this.getNodeParameter('scenario', itemIndex) as string;
					const returnProperties = this.getNodeParameter('returnProperties', itemIndex) as boolean;

					const request = new requests.RecommendUsersToItem(itemId, count, { scenario, returnProperties });
					request.timeout = timeout;

					const data = await sendWithRetry(request, maxRetries);
					return { json: { success: true, itemId, count, scenario, returnProperties, data } };
				} catch (error) {
					if (this.continueOnFail()) {
						return { json: { success: false, error: error.message }, pairedItem: itemIndex };
					}
					throw new NodeOperationError(this.getNode(), error);
				}
			});
			const batchResults = await Promise.all(batchPromises);
			returnData.push(...batchResults);
		}

		return [returnData];
	}
}

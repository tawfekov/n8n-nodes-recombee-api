import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeOperationError,
	NodeConnectionTypes,
} from 'n8n-workflow';
import { ApiClient as RecombeeClient, requests } from 'recombee-api-client';

export class RecombeeRecommendNextItems implements INodeType {
	description: INodeTypeDescription = {
		usableAsTool: true,
		displayName: 'Recombee RecommendNextItems',
		name: 'recombeeRecommendNextItems',
		icon: 'file:../RecombeeNode.svg',
		group: ['transform'],
		version: 1,
		description: 'RecommendNextItems operation from Recombee with batching',
		defaults: {
			name: 'Recommend Next Items',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'recombeeCredentialsApi', required: true }],
		properties: [
			{
				displayName: 'RecommID',
				name: 'recommId',
				type: 'string',
				default: '',
				required: true,
				description: 'The ID of the previous recommendation',
			},
			{
				displayName: 'Count',
				name: 'count',
				type: 'number',
				default: 100,
				required: true,
				description: 'The number of recommended items to return',
			},
			{
				displayName: 'Timeout (Ms)',
				name: 'timeout',
				type: 'number',
				default: 10000,
				description: 'Request timeout in milliseconds',
			},
			{
				displayName: 'Max Retries',
				name: 'maxRetries',
				type: 'number',
				default: 2,
				description: 'Number of retry attempts on failure',
			},
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
					const recommId = this.getNodeParameter('recommId', itemIndex) as string;
					const count = this.getNodeParameter('count', itemIndex) as number;
					const request = new requests.RecommendNextItems(recommId, count);
					request.timeout = timeout;

					const data = await sendWithRetry(request, maxRetries);
					return { json: { success: true, recommId, count, data } };
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

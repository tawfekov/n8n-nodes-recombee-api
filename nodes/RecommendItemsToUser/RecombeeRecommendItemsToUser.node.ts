import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeOperationError,
	NodeConnectionType,
} from 'n8n-workflow';
import { ApiClient as RecombeeClient, requests } from 'recombee-api-client';

export class RecombeeRecommendItemsToUser implements INodeType {
	description: INodeTypeDescription = {
		usableAsTool: true,
		displayName: 'Recombee RecommendItemsToUser',
		name: 'recombeeRecommendItemsToUser',
		icon: 'file:../RecombeeNode.svg',
		group: ['transform'],
		version: 1,
		description: 'Generates personalized item recommendations for a specific user based on their interaction history and preferences. This is the core recommendation operation that powers personalized suggestions',
		defaults: {
			name: 'RecommendItemsToUser',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [{ name: 'recombeeCredentialsApi', required: true }],
		properties: [
			{
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				default: '',
				required: true,
				description: 'The ID of the user to get recommendations for',
			},
			{
				displayName: 'Count',
				name: 'count',
				type: 'number',
				default: 10,
				description: 'Number of recommendations to return',
			},
			{
				displayName: 'Scenario',
				name: 'scenario',
				type: 'string',
				default: '',
				description: 'Optional scenario name to use for recommendations',
			},
			{
				displayName: 'Filter',
				name: 'filter',
				type: 'string',
				default: '',
				description: 'Optional ReQL filter expression to filter recommendations',
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
		const maxRetries = this.getNodeParameter('maxRetries', 0) as number;
		const timeout = this.getNodeParameter('timeout', 0) as number;
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
					const userId = this.getNodeParameter('userId', itemIndex) as string;
					const count = this.getNodeParameter('count', itemIndex) as number;
					const scenario = this.getNodeParameter('scenario', itemIndex) as string;

					const request = new requests.RecommendItemsToUser(userId, count, { scenario });
					request.timeout = timeout;

					const data = await sendWithRetry(request, maxRetries);
					return { json: { success: true, userId, count, scenario, data } };
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

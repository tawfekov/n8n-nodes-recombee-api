import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeOperationError,
	NodeConnectionTypes,
} from 'n8n-workflow';
import { ApiClient as RecombeeClient, requests } from 'recombee-api-client';

export class RecombeeListUsers implements INodeType {
	description: INodeTypeDescription = {
		usableAsTool: true,
		displayName: 'Recombee ListUsers',
		name: 'recombeeListUsers',
		icon: 'file:../RecombeeNode.svg',
		group: ['transform'],
		version: 1,
		description: 'ListUsers operation from Recombee',
		defaults: {
			name: 'ListUsers',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'recombeeCredentialsApi', required: true }],
		properties: [
			{ displayName: 'Max Retries', name: 'maxRetries', type: 'number', default: 2, description: 'Number of times to retry failed batch requests' },
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
		const processedItems: any[] = [];

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
				// @todo: this must be improved
				const request = new requests.ListUsers();
				request.timeout = timeout;
				batchRequests.push(request);
				processedItems.push({ index: i });

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

import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeConnectionType,
} from 'n8n-workflow';
import { ApiClient as RecombeeClient, requests } from 'recombee-api-client';

export class RecombeeResetDatabase implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Recombee ResetDatabase',
		name: 'recombeeResetDatabase',
		icon: 'file:../RecombeeNode.svg',
		group: ['transform'],
		version: 1,
		description: 'ResetDatabase operation from Recombee',
		defaults: {
			name: 'ResetDatabase',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [{ name: 'recombeeCredentialsApi', required: true }],
		properties: [],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('recombeeCredentialsApi');

		const client = new RecombeeClient(
			credentials.recombee_database_id.toString(),
			credentials.recombee_database_private_token.toString(),
			{ region: credentials.recombee_database_region.toString() },
		);

		for (let i = 0; i < items.length; i++) {
			try {
				const request = new requests.ResetDatabase();
				request.timeout = parseInt(credentials.recombee_api_timeout.toString()) ?? 10000;
				const status = await client.send(request);
				returnData.push({ json: { success: true, status } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { success: false, error: error.message }, pairedItem: i });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

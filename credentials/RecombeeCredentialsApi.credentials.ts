import {
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class RecombeeCredentialsApi implements ICredentialType {
	name = 'recombeeCredentialsApi';
	displayName = 'Recombee Credentials API';
	icon: Icon = 'file:../nodes/RecombeeNode.svg';
	documentationUrl = 'https://docs.recombee.com/api.html';
	properties: INodeProperties[] = [
		{
			displayName: 'Recombee Database ID',
			name: 'recombee_database_id',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Recombee Database Private Token',
			name: 'recombee_database_private_token',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
		},
		{
			displayName: 'Recombee Region',
			name: 'recombee_database_region',
			type: 'string',
			default: 'us-west',
		},
		{
			displayName: 'Recombee API Timeout',
			name: 'recombee_api_timeout',
			type: 'number',
			default: 10000,
		},
	];
}

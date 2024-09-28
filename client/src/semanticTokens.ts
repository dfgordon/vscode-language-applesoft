/** This provider simply sends a request to the language server.
 * The reason we explicitly handle this request using the client side provider
 * is to allow highlighting of an untitled document.
 */

import * as vscode from 'vscode';
import * as vsclnt from 'vscode-languageclient';
import { client } from './extension';

export class SemanticTokensProvider implements vscode.DocumentSemanticTokensProvider
{
	register()
	{
		// these are also defined by the server, they need to be consistent
		const tokenTypes = [
			'comment', 'string', 'keyword', 'number', 'regexp', 'operator', 'namespace',
			'type', 'struct', 'class', 'interface', 'enum', 'typeParameter', 'function',
			'method', 'decorator', 'macro', 'variable', 'parameter', 'property', 'label'
		];
		const tokenModifiers = [
			'declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated',
			'modification', 'async'
		];
		
		const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
		vscode.languages.registerDocumentSemanticTokensProvider({ language: 'applesoft' }, this, legend);
	}
	provideDocumentSemanticTokens(document:vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens>
	{
		try {
			return client.sendRequest(vsclnt.ExecuteCommandRequest.type, {
				command: 'applesoft.semantic.tokens',
				arguments: [document.getText()]
			});
		} catch (error) {
			if (error instanceof vsclnt.ResponseError)
				vscode.window.showErrorMessage(error.message);
			else
				vscode.window.showErrorMessage("unknown error");
		}
		return null;
	}
}
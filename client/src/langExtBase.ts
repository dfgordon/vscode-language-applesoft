import * as vscode from 'vscode';
import * as vsclnt from 'vscode-languageclient';
import { client } from './extension';
import * as path from 'path';

type ArgType = null | undefined | boolean | string | string[] | number | number[] |
	vsclnt.Range | vsclnt.TextDocumentItem;

export function verify_document() : {ed:vscode.TextEditor,doc:vscode.TextDocument} | undefined {
	const textEditor = vscode.window.activeTextEditor;
	if (!textEditor)
		return undefined;
	const document = textEditor.document;
	if (!document || document.languageId!='applesoft')
		return undefined;
	return {ed:textEditor,doc:document};
}
	
export class LangExtBase
{
	config: vscode.WorkspaceConfiguration;
	binPath: string;
	outPath: string;
	constructor(ctx: vscode.ExtensionContext)
	{
		this.config = vscode.workspace.getConfiguration('applesoft');
		this.binPath = ctx.asAbsolutePath('server');
		this.outPath = ctx.asAbsolutePath(path.join('client', 'out'));
	}
}

/** send request to the language server.
 * @throws vsclnt.ResponseError */
export async function request<T>(cmd: string, args: ArgType[]): Promise<T> {
	return await client.sendRequest(vsclnt.ExecuteCommandRequest.type, {
		command: cmd,
		arguments: args
	});
}

export async function proceedDespiteErrors(document: vscode.TextDocument,actionDesc: string,rng: vscode.Range | undefined) : Promise<boolean>
{
	const collection = vscode.languages.getDiagnostics(document.uri);
	let err = false;
	collection.forEach(d => {
		if (d.severity==vscode.DiagnosticSeverity.Error)
			if (!rng || (rng && d.range.start.line >= rng.start.line && d.range.end.line <= rng.end.line ))
				err = true;
	});
	if (err)
	{
		const result = await vscode.window.showWarningMessage(
			actionDesc + ' with errors is not recommended.  Proceed anyway?',
			'Proceed','Cancel');
		if (result!='Proceed')
			return false;
	}
	return true;
}

export function selectionToLineRange(sel: vscode.Selection): [number, number] {
	const beg = sel.start.line;
	let end = sel.end.line;
	if (sel.end.character != 0) {
		end += 1;
	}
	return [beg, end];
}
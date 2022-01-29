import * as vscode from 'vscode';
import * as path from 'path';
import { platform } from 'os';
import { LangExtBase, LineNumberTool } from './langExtBase';
import { spawn } from 'child_process';

/// return a range that expands the selection minimally to encompass complete lines
function extended_selection(textEditor: vscode.TextEditor) : vscode.Range | undefined
{
	const sel = textEditor.selection;
	if (!sel.isEmpty)
	{
		const ext_start = new vscode.Position(sel.start.line,0);
		let ext_end = undefined;
		if (sel.end.character==0)
			ext_end = textEditor.document.lineAt(sel.end.line-1).range.end;
		else
			ext_end = textEditor.document.lineAt(sel.end.line).range.end;
		return new vscode.Range(ext_start,ext_end);
	}
	return undefined;
}

export class RenumberTool extends LangExtBase
{
	async command()
	{
		let start: string | undefined = undefined;
		let step: string | undefined = undefined;
		let textEditor = vscode.window.activeTextEditor;
		if (textEditor)
		{
			const document = textEditor.document;
			if (document && document.languageId=='applesoft')
			{
				const collection = vscode.languages.getDiagnostics(document.uri);
				let err = false;
				let proceed = true;
				collection.forEach(d => {
					if (d.severity==vscode.DiagnosticSeverity.Error)
						err = true;
				});
				if (err)
				{
					const result = await vscode.window.showWarningMessage(
						'Renumbering a document with errors is not recommended.  Proceed anyway?',
						'Proceed','Cancel');
					if (result!='Proceed')
						proceed = false;
				}
				if (proceed)
				{
					start = await vscode.window.showInputBox({title:'starting line number'});
					step = await vscode.window.showInputBox({title:'step between lines'});
				}
			}
		}
		if (start && step)
		{
			const l0 = parseInt(start);
			const dl = parseInt(step);
			if (!isNaN(l0) && !isNaN(dl) && l0>=0 && dl>=1)
			{
				textEditor = vscode.window.activeTextEditor;
				if (textEditor)
				{
					const document = textEditor.document;
					if (document && document.languageId=='applesoft')
					{
						// refine the selection and parse
						let lower_guard = undefined;
						let upper_guard = undefined;
						let txt = document.getText();
						const ext_sel = extended_selection(textEditor);
						if (ext_sel)
						{
							let l = ext_sel.start.line - 1;
							while (l>=0 && !lower_guard)
							{
								const matches = document.lineAt(l).text.match(/^\s*[0-9 ]+/);
								if (matches)
									lower_guard = parseInt(matches[0])+1;
								l--;
							}
							l = ext_sel.end.line + 1;
							while (l<document.lineCount && !upper_guard)
							{
								const matches = document.lineAt(l).text.match(/^\s*[0-9 ]+/);
								if (matches)
									upper_guard = parseInt(matches[0])-1;
								l++;
							}
							txt = document.getText(ext_sel);
						}
						let syntaxTree = this.parse(txt+"\n");
						let lineTool = new LineNumberTool(syntaxTree);
						const line_numbers = lineTool.get_nums();
						const lN = l0 + dl*(line_numbers.length-1);
						if (!lower_guard)
							lower_guard = 0;
						if (!upper_guard)
							upper_guard = 63999;
						if (lower_guard<0)
							lower_guard = 0;
						if (upper_guard>63999)
							upper_guard = 63999;
						if (l0>=lower_guard && lN<=upper_guard)
						{
							// setup the mapping from old to new line numbers
							const mapping = new Map<number,number>();
							for (let i=0;i<line_numbers.length;i++)
								mapping.set(line_numbers[i],l0+i*dl);
							// now apply the mapping to the whole document
							txt = document.getText();
							syntaxTree = this.parse(txt+"\n");
							lineTool = new LineNumberTool(syntaxTree);
							textEditor.edit(editBuilder => { lineTool.renumber(mapping,editBuilder); });
						}
						else
							vscode.window.showErrorMessage('new range ('+l0+','+lN+') exceeds bounds ('+lower_guard+','+upper_guard+')');
					}
				}
			}
			else
				vscode.window.showErrorMessage('start and step parameters invalid');
		}
	}
}

export function commentLinesCommand(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit)
{
	const document = textEditor.document;
	if (document && document.languageId=='applesoft')
	{
		let ext_sel = extended_selection(textEditor);
		if (!ext_sel)
			ext_sel = document.lineAt(textEditor.selection.start.line).range;
		if (ext_sel)
		{
			let txt = document.getText(ext_sel);
			if (/^\s*[0-9 ]+R *E *M/.test(txt))
				txt = txt.replace(/^(\s*[0-9 ]+)(R *E *M *)/gm,'$1');
			else
				txt = txt.replace(/^(\s*[0-9 ]+)/gm,'$1REM ');
			edit.replace(ext_sel,txt);
		}
	}
}

function actionViiGo(action: string,machine: string)
{
	const textEditor = vscode.window.activeTextEditor;
	if (textEditor)
	{
		const document = textEditor.document;
		if (document && document.languageId=='applesoft')
		{
			const programText = document.getText() + "\n";
			const scriptPath = path.join(__dirname,'../vscode-to-vii.scpt');
			spawn('osascript',[scriptPath,action,machine,programText]);
		}
	}
}

function actionVii(action: string,machine: string)
{
	if (platform() !== 'darwin')
	{
		vscode.window.showWarningMessage('This command is only available on macOS');
		return;
	}
	if (machine=="front")
	{
		vscode.window.showWarningMessage(
			'Please save your work in the front Virtual ][ window and verify the Applesoft prompt is ready.',
			'Proceed','Cancel').
			then( result => {
				if (result=='Proceed')
					actionViiGo(action,machine);
			});
	}
	else
		actionViiGo(action,machine);
}

export function runNewVirtualII()
{
	actionVii("run","stockiie");
}

export function runFrontVirtualII()
{
	actionVii("run","front");
}

export function enterNewVirtualII()
{
	actionVii("enter","stockiie");
}

export function enterFrontVirtualII()
{
	actionVii("enter","front");
}


import * as vscode from 'vscode';
import * as path from 'path';
import { platform } from 'os';
import { LangExtBase, LineNumberTool } from './langExtBase';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as YAML from 'yaml';
import * as detokenize_map from './detokenize_map.json';

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
			if (isNaN(l0) || isNaN(dl) || l0<0 || dl<1)
			{
				vscode.window.showErrorMessage('start and step parameters invalid');
				return;
			}
			textEditor = vscode.window.activeTextEditor;
			if (!textEditor)
				return;
			const document = textEditor.document;
			if (!document || document.languageId!='applesoft')
				return;
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
			if (l0<lower_guard || lN>upper_guard)
			{
				vscode.window.showErrorMessage('new range ('+l0+','+lN+') exceeds bounds ('+lower_guard+','+upper_guard+')');
				return;
			}
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
	const config = vscode.workspace.getConfiguration('applesoft');
	const colorMonitor = config.get('vii.color') ? "1" : "0";
	const speed = config.get('vii.speed') as string;
	if (textEditor)
	{
		const document = textEditor.document;
		if (document && document.languageId=='applesoft')
		{
			const programText = document.getText() + "\n";
			const scriptPath = path.join(__dirname,'../vscode-to-vii.scpt');
			const process = spawn('osascript',[scriptPath,action,machine,speed,colorMonitor,programText]);
			process.stderr.on('data',data => {
				vscode.window.showErrorMessage(`${data}`);
			});
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
	const config = vscode.workspace.getConfiguration('applesoft');
	if (machine=="front")
	{
		const warn = config.get('warn.run');
		if (warn)
			vscode.window.showWarningMessage(
				'Please save your work in the front Virtual ][ window and verify the Applesoft prompt is ready.',
				'Proceed','Cancel').
				then( result => {
					if (result=='Proceed')
						actionViiGo(action,machine);
				});
		else
				actionViiGo(action,machine);
	}
	else
	{
		const newMachine = config.get('vii.newMachine') as string;
		actionViiGo(action,newMachine);
	}
}

export function runNewVirtualII()
{
	actionVii("run","new");
}

export function runFrontVirtualII()
{
	actionVii("run","front");
}

export function enterNewVirtualII()
{
	actionVii("enter","new");
}

export function enterFrontVirtualII()
{
	actionVii("enter","front");
}

function detokenize(img: Buffer) : string
{
	let addr = img[103] + img[104]*256;
	let code = '\n';
	while (img[addr]!=0 && addr<2**16) {
		addr += 2; // skip link address
		const line_num = img[addr] + img[addr+1]*256;
		code += line_num.toString() + ' ';
		addr += 2;
		while (img[addr]!=0) {
			if (img[addr]>127)
				code += ' ' + Object(detokenize_map)[img[addr].toString()].toUpperCase() + ' ';
			else
				code += String.fromCharCode(img[addr]);
			addr += 1;
		}
		code += '\n';
		addr += 1;
	}
	return code;
}

export function getFrontVirtualII()
{
	if (platform() !== 'darwin')
	{
		vscode.window.showWarningMessage('This command is only available on macOS');
		return;
	}
	const textEditor = vscode.window.activeTextEditor;
	if (!textEditor)
		return;
	const document = textEditor.document;
	if (!document || document.languageId!='applesoft')
		return;
	const config = vscode.workspace.getConfiguration('applesoft');
	const colorMonitor = config.get('vii.color') ? "1" : "0";
	const speed = config.get('vii.speed') as string;
	const scriptPath = path.join(__dirname,'../vscode-to-vii.scpt');
	const dumpPath = path.join(__dirname,'scratch.dump');
	const process = spawn('osascript',[scriptPath,"get","front",speed,colorMonitor,dumpPath]);
	process.stderr.on('data',data => {
		vscode.window.showErrorMessage(`${data}`);
	});
	process.on('close',(code) => {
		if (code===0)
		{
			const img = fs.readFileSync(dumpPath);
			const code = detokenize(img);
			if (code.length>1)
				textEditor.edit( edit => { edit.replace(textEditor.selection,code); });
			else
				vscode.window.showWarningMessage('no program was found to insert');
		}
	});
}

export function getAppleWinSaveState()
{
	const textEditor = vscode.window.activeTextEditor;
	if (!textEditor)
		return;
	const document = textEditor.document;
	if (!document || document.languageId!='applesoft')
		return;
	const config = vscode.workspace.getConfiguration('applesoft');
	vscode.window.showOpenDialog({
		"canSelectMany": false,
		"canSelectFiles":true,
		"filters": {"Save state": ["yaml"]},
		"title": "Insert from AppleWin State"
	}).then(uri => {
		if (!uri)
			return;
		const yamlString = fs.readFileSync(uri[0].fsPath,'utf8');
		const yamlTree = YAML.parseAllDocuments(yamlString,{"schema": "failsafe"})[0];
		const block64Map = yamlTree.get('Unit').get('State').get('Main Memory');
		const buffList = new Array<Buffer>();
		for (const p of block64Map.items)
			buffList.push(Buffer.from(p.value.value,"hex"));
		const img = Buffer.concat(buffList);
		const code = detokenize(img);
		if (code.length>1)
			textEditor.edit( edit => { edit.replace(textEditor.selection,code); });
		else
			vscode.window.showWarningMessage('no program was found to insert');
	});
}

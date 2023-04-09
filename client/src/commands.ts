import * as vscode from 'vscode';
import * as path from 'path';
import { platform } from 'os';
import * as lxbase from './langExtBase';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as YAML from 'yaml';
import { client } from './extension';
import * as vsclnt from 'vscode-languageclient';

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

async function proceedDespiteErrors(document: vscode.TextDocument,actionDesc: string) : Promise<boolean>
{
	const collection = vscode.languages.getDiagnostics(document.uri);
	let err = false;
	collection.forEach(d => {
		if (d.severity==vscode.DiagnosticSeverity.Error)
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

export class RenumberTool extends lxbase.LangExtBase
{
	async command()
	{
		let start: string | undefined = undefined;
		let step: string | undefined = undefined;
		let updateAll: string | undefined = undefined;
		const verified = this.verify_document();
		if (verified)
		{
			const proceed = await proceedDespiteErrors(verified.doc,'Renumbering a document');
			if (proceed)
			{
				start = await vscode.window.showInputBox({title:'starting line number'});
				step = await vscode.window.showInputBox({title:'step between lines'});
				updateAll = await vscode.window.showQuickPick(['update all references','change only primary line numbers'],{canPickMany:false,title:'select methodology'});
				const r = extended_selection(verified.ed);
				let rng : vsclnt.Range | null;
				if (r)
					rng = vsclnt.Range.create(r.start, r.end);
				else
					rng = null;
				const response = await client.sendRequest(vsclnt.ExecuteCommandRequest.type,
					{
						command: 'applesoft.renumber',
						arguments: [
							vsclnt.TextDocumentItem.create(verified.doc.uri.toString(),'applesoft',verified.doc.version,verified.doc.getText()),
							rng,
							start,
							step,
							updateAll=='update all references'
						]
					});
				if (response != '') {
					vscode.window.showErrorMessage(response);
				}
			}
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

export class ViiEntryTool extends lxbase.LangExtBase
{
	getFrontVirtualII()
	{
		if (platform() !== 'darwin')
		{
			vscode.window.showWarningMessage('This command is only available on macOS');
			return;
		}
		const verified = this.verify_document();
		if (!verified)
			return;
		const config = vscode.workspace.getConfiguration('applesoft');
		const colorMonitor = config.get('vii.color') ? "1" : "0";
		const speed = config.get('vii.speed') as string;
		const scriptPath = path.join(__dirname,'vscode-to-vii.scpt');
		const dumpPath = path.join(__dirname,'scratch.dump');
		const process = spawn('osascript',[scriptPath,"get","front",speed,colorMonitor,dumpPath]);
		process.stderr.on('data',data => {
			vscode.window.showErrorMessage(`${data}`);
		});
		process.on('close',async (code) => {
			if (code===0)
			{
				const img = fs.readFileSync(dumpPath);
				const img_messg: number[] = Array.from(Uint8Array.from(img));
				const code = await client.sendRequest(vsclnt.ExecuteCommandRequest.type,
					{
						command: 'applesoft.detokenize',
						arguments: img_messg
					});
				if (code && code.length>1)
					verified.ed.edit( edit => { edit.replace(verified.ed.selection,code); });
				else
					vscode.window.showWarningMessage('no program was found to insert');
			}
		});
	}
	actionViiGo(action: string,machine: string)
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
				const scriptPath = path.join(__dirname,'vscode-to-vii.scpt');
				const process = spawn('osascript',[scriptPath,action,machine,speed,colorMonitor,programText]);
				process.stderr.on('data',data => {
					vscode.window.showErrorMessage(`${data}`);
				});
			}
		}
	}
	async actionVii(action: string,machine: string)
	{
		if (platform() !== 'darwin')
		{
			vscode.window.showWarningMessage('This command is only available on macOS');
			return;
		}
		const verified = this.verify_document();
		if (!verified)
			return;
		const proceed = await proceedDespiteErrors(verified.doc,'Entering a program');
		if (!proceed)
			return;
		if (machine=="front")
		{
			const warn = vscode.workspace.getConfiguration('applesoft').get('warn.run');
			let res : string | undefined = 'Proceed';
			if (warn)
				res = await vscode.window.showWarningMessage(
					'Please save your work in the front Virtual ][ window and verify the Applesoft prompt is ready.',
					'Proceed','Cancel');
			if (res=='Proceed')
				this.actionViiGo(action,machine);
		}
		else
		{
			const newMachine = vscode.workspace.getConfiguration('applesoft').get('vii.newMachine') as string;
			this.actionViiGo(action,newMachine);
		}
	}
	runNewVirtualII()
	{
		this.actionVii("run","new");
	}
	runFrontVirtualII()
	{
		this.actionVii("run","front");
	}
	enterNewVirtualII()
	{
		this.actionVii("enter","new");
	}
	enterFrontVirtualII()
	{
		this.actionVii("enter","front");
	}
}

export class AppleWinTool extends lxbase.LangExtBase
{
	// Note on string encoding:
	// Because JavaScript uses UTF16, 8 bit binary data can be put directly into a string
	// with little trouble, since any value from 0-255 is mapped to exactly one code point.
	// We use the name `raw_str` to indicate that the string may contain binary data encoded
	// in this straightforward way.  When transferring to/from A2 memory images the
	// low bytes from the code points are put into a Uint8Array.
	// WARNING: text based manipulations are unsafe on `raw_str`.
	// The `persistentSpace` code is used to allow spaces to be safely stripped from `raw_str`.
	encode_int16(int16: number) : string
	{
		const hiByte = Math.floor(int16/256);
		const loByte = int16 - hiByte*256;
		return String.fromCharCode(loByte) + String.fromCharCode(hiByte);
	}
	buffer_from_raw_str(raw_str: string) : Buffer
	{
		const rawBinary = new Uint8Array(raw_str.length);
		for (let i=0;i<raw_str.length;i++)
			rawBinary[i] = raw_str.charCodeAt(i);
		return Buffer.from(rawBinary);
	}
	openAppleWinSaveState(uri : vscode.Uri[]|undefined) : [tree:any|undefined,blockMap:any|undefined,path:fs.PathLike|undefined]
	{
		if (!uri)
			return [undefined,undefined,undefined];
		const yamlString = fs.readFileSync(uri[0].fsPath,'utf8');
		const yamlTree : any = YAML.parseAllDocuments(yamlString,{uniqueKeys: false,schema: "failsafe"})[0];
		if (yamlTree.errors.length>0)
		{
			vscode.window.showErrorMessage('Failed to parse YAML');
			return [undefined,undefined,undefined];
		}
		const block64Map = yamlTree.getIn(['Unit','State','Main Memory']);
		if (!block64Map)
		{
			vscode.window.showErrorMessage('Could not find keys in YAML file');
			return [undefined,undefined,undefined];
		}
		return [yamlTree,block64Map,uri[0].fsPath];
	}
	async appleWinSaveStateGo()
	{
		const verified = this.verify_document();
		if (!verified)
			return;
		const uri = await vscode.window.showOpenDialog({
			"canSelectMany": false,
			"canSelectFiles": true,
			"filters": { "Save state": ["yaml"] },
			"title": "Store in AppleWin State"
		});
		const [yamlTree,block64Map,yamlPath] = this.openAppleWinSaveState(uri);
		if (!yamlTree || !block64Map || !yamlPath)
			return;
		// construct the image of the machine's main memory
		const buffList = new Array<Buffer>();
		for (const p of block64Map.items)
			buffList.push(Buffer.from(p.value.value,"hex"));
		const img = Buffer.concat(buffList);

		// form the image of the tokenized program
		const baseAddr = img[103] + 256*img[104];
		const code = await client.sendRequest(vsclnt.ExecuteCommandRequest.type,
			{
				command: 'applesoft.tokenize',
				arguments: [verified.doc.getText(),baseAddr]
			});
		const lomem = baseAddr + code.length;
		const himem = img[115] + 256*img[116];
		if (lomem>himem)
		{
			vscode.window.showErrorMessage('LOMEM would exceed HIMEM');
			return;
		}

		// insert program image and update zero page pointers
		const lomemBuff = this.buffer_from_raw_str(this.encode_int16(lomem));
		const himemBuff = this.buffer_from_raw_str(this.encode_int16(himem));
		img.set(this.buffer_from_raw_str(code),baseAddr);
		img.set(lomemBuff,105); // start of variable space
		img.set(lomemBuff,107); // start of array space
		img.set(lomemBuff,109); // end of array space
		img.set(himemBuff,111); // start of string space
		img.set(lomemBuff,175); // end of program

		// write the changes
		for (let block=0;block<1024;block++)
		{
			img.copy(buffList[block],0,block*64,(block+1)*64);
			block64Map.items[block].value.value = buffList[block].toString('hex');
		}
		fs.writeFileSync(yamlPath, yamlTree.toString());
		vscode.window.showInformationMessage('program stored in ' + yamlPath.toString());
	}
	async setAppleWinSaveState()
	{
		const verified = this.verify_document();
		if (!verified)
			return;
		const proceed = await proceedDespiteErrors(verified.doc,'Setting save state');
		if (!proceed)
			return;
		const warn = vscode.workspace.getConfiguration('applesoft').get('warn.run');
		let res : string | undefined = 'Proceed';
		if (warn)
			res = await vscode.window.showWarningMessage(
				'This will erase the program and variables in the state file.',
				'Proceed','Cancel');
		if (res=='Proceed')
			this.appleWinSaveStateGo();	
	}
	async getAppleWinSaveState()
	{
		const verified = this.verify_document();
		if (!verified)
			return;
		const config = vscode.workspace.getConfiguration('applesoft');
		const uri = await vscode.window.showOpenDialog({
			"canSelectMany": false,
			"canSelectFiles": true,
			"filters": { "Save state": ["yaml"] },
			"title": "Insert from AppleWin State"
		});
		const [yamlTree,block64Map,yamlPath] = this.openAppleWinSaveState(uri);
		if (!yamlTree || !block64Map || !yamlPath)
			return;
		const buffList = new Array<Buffer>();
		for (const p of block64Map.items)
			buffList.push(Buffer.from(p.value.value,"hex"));
		const img = Buffer.concat(buffList);
		const img_messg: number[] = Array.from(Uint8Array.from(img));
		const code = await client.sendRequest(vsclnt.ExecuteCommandRequest.type,
			{
				command: 'applesoft.detokenize',
				arguments: img_messg
			});
		if (code.length>1)
			verified.ed.edit( edit => { edit.replace(verified.ed.selection,code); });
		else
			vscode.window.showWarningMessage('no program was found to insert');
	}
}

export class TokenizationTool extends lxbase.LangExtBase
{
	currAddr = 2049;
	async showTokenizedProgram()
	{
		let verified = this.verify_document();
		if (!verified)
			return;
		const proceed = await proceedDespiteErrors(verified.doc,'Tokenizing');
		if (!proceed)
			return;
		const res = await vscode.window.showInputBox({title:'enter the base address',placeHolder: '2049'});
		if (res==undefined)
			return;
		const baseAddr = parseInt(res?res:"2049");
		if (baseAddr<2049 || baseAddr>49143)
		{
			vscode.window.showErrorMessage('address is out of range (2049 - 49143)');
			return;
		}
		const showUnicode = await vscode.window.showQuickPick(['unicode alongside hex','hex only'],{canPickMany:false,title:'select format'});
		if (showUnicode==undefined)
			return;
		verified = this.verify_document();
		if (!verified)
			return;
		const code = await client.sendRequest(vsclnt.ExecuteCommandRequest.type,
			{
				command: 'applesoft.tokenize',
				arguments: [verified.doc.getText(),baseAddr]
			});
		let content = '';
		for (let i=0;i<code.length;i++)
		{
			if (i%8==0 && i>0)
				if (showUnicode=='unicode alongside hex')
					content += '   ' + code.substring(i-8,i).replace(/\s/g,' ') + '\n';
				else
					content += '\n';
			if (i%8==0)
				content += (baseAddr+i).toString(16).padStart(4,'0').toUpperCase() + ': ';
			content += code.charCodeAt(i).toString(16).padStart(2,'0').toUpperCase() + ' ';
			if (i==code.length-1)
				if (showUnicode=='unicode alongside hex')
					content += ' '.repeat(3+3*(7-i%8)) + code.substring(i-i%8,i+1).replace(/\s/g,' ') + '\n';
				else
					content += '\n';
		}
		vscode.workspace.openTextDocument({content:content}).then(doc => {
			vscode.window.showTextDocument(doc);
			if (baseAddr+code.length > 49152)
				vscode.window.showInformationMessage('the program exceeds the limits of main address space');
		});
	}

	async minify_program()
	{
		let verified = this.verify_document();
		if (!verified)
			return;
		const proceed = await proceedDespiteErrors(verified.doc,'Minifying');
		if (!proceed)
			return;
		verified = this.verify_document();
		if (!verified)
			return;
		const minified = await client.sendRequest(vsclnt.ExecuteCommandRequest.type,
			{
				command: 'applesoft.minify',
				arguments: [verified.doc.getText()]
			});
		if (minified)
			vscode.workspace.openTextDocument({ language: 'applesoft', content: minified }).then(doc => {
				vscode.window.showTextDocument(doc);
			});
		else
			vscode.window.showErrorMessage('Minify failed');
	}
}

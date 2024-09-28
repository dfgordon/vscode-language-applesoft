import * as vscode from 'vscode';
import * as path from 'path';
import { platform } from 'os';
import * as lxbase from './langExtBase';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as YAML from 'yaml';
import * as vsclnt from 'vscode-languageclient';

/**
 * return a range that expands the selection minimally to encompass complete lines
 * @param textEditor the editor with the range to analyze
 * @returns either a range, or undefined if there was none
 */
function extended_selection(textEditor: vscode.TextEditor) : vscode.Range | undefined
{
	const sel = textEditor.selection;
	if (!sel.isEmpty)
	{
		const ext_start = new vscode.Position(sel.start.line,0);
		let ext_end = undefined;
		if (sel.end.character==0)
			ext_end = textEditor.document.lineAt(sel.end.line).range.end;
		else
			ext_end = textEditor.document.lineAt(sel.end.line+1).range.end;
		return new vscode.Range(ext_start,ext_end);
	}
	return undefined;
}

export class RenumberTool extends lxbase.LangExtBase
{
	async renumber_or_move(cmd: string)
	{
		let start: string | undefined = undefined;
		let step: string | undefined = undefined;
		let updateAll: string | undefined = undefined;
		const verified = lxbase.verify_document();
		if (verified)
		{
			const proceed = await lxbase.proceedDespiteErrors(verified.doc,cmd.toUpperCase(),undefined);
			if (proceed)
			{
				start = await vscode.window.showInputBox({ title: 'starting line number' });
				if (!start)
					return;
				step = await vscode.window.showInputBox({ title: 'step between lines' });
				if (!step)
					return;
				updateAll = await vscode.window.showQuickPick(['update all references','change only primary line numbers'],{canPickMany:false,title:'select methodology'});
				if (!updateAll)
					return;
				const r = extended_selection(verified.ed);
				let rng: vsclnt.Range | null = null;
				if (r) {
					rng = vsclnt.Range.create(r.start, r.end);
				}
				const docItem = vsclnt.TextDocumentItem.create(verified.doc.uri.toString(), 'applesoft', verified.doc.version, verified.doc.getText());
				try {
					await lxbase.request<null>('applesoft.' + cmd, [docItem, rng, start, step, updateAll == 'update all references']);
					// Server is supposed to send the ApplyWorkspaceEditRequest that will be handled
					// by the editor without our explicit intervention.
				} catch (error) {
					if (error instanceof Error)
						vscode.window.showErrorMessage(error.message);
				}
			}
		}
	}
	renumber() {
		this.renumber_or_move('renumber')
	}
	move() {
		this.renumber_or_move('move')
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
		const verified = lxbase.verify_document();
		if (!verified)
			return;
		const config = vscode.workspace.getConfiguration('applesoft');
		const colorMonitor = config.get('vii.color') ? "1" : "0";
		const speed = config.get('vii.speed') as string;
		const scriptPath = path.join(this.binPath,'vscode-to-vii.scpt');
		const dumpPath = path.join(this.outPath,'scratch.dump');
		const process = spawn('osascript',[scriptPath,"get","front",speed,colorMonitor,dumpPath]);
		process.stderr.on('data',data => {
			vscode.window.showErrorMessage(`${data}`);
		});
		process.on('close',async (code) => {
			if (code===0)
			{
				const img = fs.readFileSync(dumpPath);
				const img_messg: number[] = Array.from(Uint8Array.from(img));
				try {
					const code = await lxbase.request<string>('applesoft.detokenize', [img_messg]);
					verified.ed.edit( edit => { edit.replace(verified.ed.selection,code); });
				} catch (error) {
					if (error instanceof Error)
						vscode.window.showErrorMessage(error.message);
				}
			}
		});
	}
	async setVirtualIIStart(action: string,machine: string)
	{
		if (platform() !== 'darwin')
		{
			vscode.window.showWarningMessage('This command is only available on macOS');
			return;
		}
		const verified = lxbase.verify_document();
		if (!verified)
			return;
		const proceed = await lxbase.proceedDespiteErrors(verified.doc,'Entering a program',undefined);
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
				this.setVirtualIIFinish(action,machine);
		}
		else
		{
			const newMachine = vscode.workspace.getConfiguration('applesoft').get('vii.newMachine') as string;
			this.setVirtualIIFinish(action,newMachine);
		}
	}
	setVirtualIIFinish(action: string,machine: string)
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
				const scriptPath = path.join(this.binPath,'vscode-to-vii.scpt');
				const process = spawn('osascript',[scriptPath,action,machine,speed,colorMonitor,programText]);
				process.stderr.on('data',data => {
					vscode.window.showErrorMessage(`${data}`);
				});
			}
		}
	}
	runNewVirtualII()
	{
		this.setVirtualIIStart("run","new");
	}
	runFrontVirtualII()
	{
		this.setVirtualIIStart("run","front");
	}
	enterNewVirtualII()
	{
		this.setVirtualIIStart("enter","new");
	}
	enterFrontVirtualII()
	{
		this.setVirtualIIStart("enter","front");
	}
}

export class AppleWinTool extends lxbase.LangExtBase
{
	encode_int16(int16: number) : [number,number]
	{
		const loByte = int16 % 256;
		const hiByte = Math.floor(int16 / 256);
		return [loByte,hiByte];
	}
	openAppleWinSaveState(uri : vscode.Uri[]|undefined) : [tree:YAML.Document|undefined, blockMap:YAML.YAMLMap|undefined, path:fs.PathLike|undefined]
	{
		if (!uri)
			return [undefined,undefined,undefined];
		const yamlString = fs.readFileSync(uri[0].fsPath,'utf8');
		const yamlTree = YAML.parseAllDocuments(yamlString,{uniqueKeys: false,schema: "failsafe"})[0];
		if (yamlTree.errors.length>0) {
			vscode.window.showErrorMessage('Failed to parse YAML');
			return [undefined,undefined,undefined];
		}
		const block64Map = yamlTree.getIn(['Unit', 'State', 'Main Memory']);
		if (YAML.isMap(block64Map)) {
			return [yamlTree, block64Map, uri[0].fsPath];
		}
		vscode.window.showErrorMessage('Could not find keys in YAML file');
		return [undefined,undefined,undefined];
	}
	async setAppleWinSaveStateFinish(uri: vscode.Uri[] | undefined)
	{
		const verified = lxbase.verify_document();
		if (!verified)
			return;
		const [yamlTree,block64Map,yamlPath] = this.openAppleWinSaveState(uri);
		if (!yamlTree || !block64Map || !yamlPath)
			return;
		// construct the image of the machine's main memory
		const buffList = new Array<Buffer>();
		for (const pair of block64Map.items) {
			if (YAML.isScalar(pair.value) && (typeof pair.value.value === 'string')) {
				buffList.push(Buffer.from(pair.value.value, "hex"));
			}
		}
		const img = Buffer.concat(buffList);

		// form the image of the tokenized program
		try {
			const baseAddr = img[103] + 256 * img[104];
			const code = await lxbase.request<number[]>('applesoft.tokenize', [verified.doc.getText(), baseAddr]);
			const lomem = baseAddr + code.length;
			const himem = img[115] + 256 * img[116];
			if (lomem > himem) {
				vscode.window.showErrorMessage('LOMEM would exceed HIMEM');
				return;
			}

			// insert program image and update zero page pointers
			const lomemBuff = this.encode_int16(lomem);
			const himemBuff = this.encode_int16(himem);
			img.set(code, baseAddr);
			img.set(lomemBuff, 105); // start of variable space
			img.set(lomemBuff, 107); // start of array space
			img.set(lomemBuff, 109); // end of array space
			img.set(himemBuff, 111); // start of string space
			img.set(lomemBuff, 175); // end of program
		} catch (error) {
			if (error instanceof Error)
				vscode.window.showErrorMessage(error.message);
		}

		// write the changes
		for (let block=0;block<buffList.length;block++)
		{
			img.copy(buffList[block], 0, block * 64, (block + 1) * 64);
			const pair = block64Map.items[block];
			if (YAML.isScalar(pair.value) && (typeof pair.value.value === 'string')) {
				pair.value.value = buffList[block].toString('hex');
			}
		}
		fs.writeFileSync(yamlPath, yamlTree.toString());
		vscode.window.showInformationMessage('program stored in ' + yamlPath.toString());
	}
	async setAppleWinSaveState()
	{
		const verified = lxbase.verify_document();
		if (!verified)
			return;
		const proceed = await lxbase.proceedDespiteErrors(verified.doc,'Setting save state',undefined);
		if (!proceed)
			return;
		const warn = vscode.workspace.getConfiguration('applesoft').get('warn.run');
		let res : string | undefined = 'Proceed';
		if (warn)
			res = await vscode.window.showWarningMessage(
				'This will erase the program and variables in the state file.',
				'Proceed','Cancel');
		if (res != 'Proceed')
			return;
		const uri = await vscode.window.showOpenDialog({
			"canSelectMany": false,
			"canSelectFiles": true,
			"filters": { "Save state": ["yaml"] },
			"title": "Store in AppleWin State"
		});
		this.setAppleWinSaveStateFinish(uri);	
	}
	async getAppleWinSaveState()
	{
		const verified = lxbase.verify_document();
		if (!verified)
			return;
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
		for (const pair of block64Map.items) {
			if (YAML.isScalar(pair.value) && (typeof pair.value.value === 'string')) {
				buffList.push(Buffer.from(pair.value.value, "hex"));
			}
		}
		const img = Buffer.concat(buffList);
		const img_messg: number[] = Array.from(Uint8Array.from(img));
		try {
			const code = await lxbase.request<string>('applesoft.detokenize', [img_messg]);
			verified.ed.edit( edit => { edit.replace(verified.ed.selection,code); });
		} catch (error) {
			if (error instanceof Error)
				vscode.window.showErrorMessage(error.message);
		}
	}
}

export class TokenizationTool extends lxbase.LangExtBase
{
	currAddr = 2049;
	displayPosString(toks: number[]): string {
		let ans = '';
		for (let i = 0; i < toks.length; i++) {
			const c = toks[i];
			ans += c > 32 && c < 127 ? String.fromCharCode(c) : "."; 
		}
		return ans;
	}
	async showTokenizedProgram()
	{
		let verified = lxbase.verify_document();
		if (!verified)
			return;
		const proceed = await lxbase.proceedDespiteErrors(verified.doc,'Tokenizing',undefined);
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
		const showUnicode = await vscode.window.showQuickPick(['ascii alongside hex','hex only'],{canPickMany:false,title:'select format'});
		if (showUnicode==undefined)
			return;
		verified = lxbase.verify_document();
		if (!verified)
			return;
		try {
			const code = await lxbase.request<number[]>('applesoft.tokenize', [verified.doc.getText(), baseAddr]);	
			let content = '';
			for (let i=0;i<code.length;i++)
			{
				if (i%8==0 && i>0)
					if (showUnicode=='ascii alongside hex')
						content += '   ' + this.displayPosString(code.slice(i-8,i)) + '\n';
					else
						content += '\n';
				if (i%8==0)
					content += (baseAddr+i).toString(16).padStart(4,'0').toUpperCase() + ': ';
				content += code[i].toString(16).padStart(2,'0').toUpperCase() + ' ';
				if (i==code.length-1)
					if (showUnicode=='ascii alongside hex')
						content += ' '.repeat(3+3*(7-i%8)) + this.displayPosString(code.slice(i-i%8,i+1)) + '\n';
					else
						content += '\n';
			}
			vscode.workspace.openTextDocument({content:content}).then(doc => {
				vscode.window.showTextDocument(doc);
				if (baseAddr+code.length > 49152)
					vscode.window.showInformationMessage('the program exceeds the limits of main address space');
			});
		} catch (error) {
			if (error instanceof Error)
				vscode.window.showErrorMessage(error.message);
		}
	}

	async minify_program()
	{
		let verified = lxbase.verify_document();
		if (!verified)
			return;
		const proceed = await lxbase.proceedDespiteErrors(verified.doc,'Minifying',undefined);
		if (!proceed)
			return;
		verified = lxbase.verify_document();
		if (!verified)
			return;
		try {
			const minified = await lxbase.request<string>('applesoft.minify', [verified.doc.getText()]);
			vscode.workspace.openTextDocument({ language: 'applesoft', content: minified }).then(doc => {
				vscode.window.showTextDocument(doc);
			});
		} catch (error) {
			if (error instanceof Error)
				vscode.window.showErrorMessage(error.message);
		}
	}
}

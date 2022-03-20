import * as vscode from 'vscode';
import * as path from 'path';
import { platform } from 'os';
import * as lxbase from './langExtBase';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as YAML from 'yaml';
import * as detokenize_map from './detokenize_map.json';
import * as tokenize_map from './tokenize_map.json';
import Parser = require('web-tree-sitter');

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

export class RenumberTool extends lxbase.LineNumberTool
{
	async command()
	{
		let start: string | undefined = undefined;
		let step: string | undefined = undefined;
		let updateAll: string | undefined = undefined;
		let verified = this.verify_document();
		if (verified)
		{
			const proceed = await proceedDespiteErrors(verified.doc,'Renumbering a document');
			if (proceed)
			{
				start = await vscode.window.showInputBox({title:'starting line number'});
				step = await vscode.window.showInputBox({title:'step between lines'});
				updateAll = await vscode.window.showQuickPick(['update all references','change only primary line numbers'],{canPickMany:false,title:'select methodology'});
			}
		}
		if (start && step && updateAll)
		{
			const l0 = parseInt(start);
			const dl = parseInt(step);
			if (isNaN(l0) || isNaN(dl) || l0<0 || dl<1)
			{
				vscode.window.showErrorMessage('start and step parameters invalid');
				return;
			}
			verified = this.verify_document();
			if (!verified)
				return;
			// refine the selection and parse
			let lower_guard = undefined;
			let upper_guard = undefined;
			let txt = verified.doc.getText();
			const ext_sel = extended_selection(verified.ed);
			if (ext_sel)
			{
				let l = ext_sel.start.line - 1;
				while (l>=0 && !lower_guard)
				{
					const matches = verified.doc.lineAt(l).text.match(/^\s*[0-9 ]+/);
					if (matches)
						lower_guard = parseInt(matches[0])+1;
					l--;
				}
				l = ext_sel.end.line + 1;
				while (l<verified.doc.lineCount && !upper_guard)
				{
					const matches = verified.doc.lineAt(l).text.match(/^\s*[0-9 ]+/);
					if (matches)
						upper_guard = parseInt(matches[0])-1;
					l++;
				}
				txt = verified.doc.getText(ext_sel);
			}
			let syntaxTree = this.parse(txt,"\n");
			const line_numbers = this.get_primary_nums(syntaxTree);
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
			// apply the mapping
			txt = verified.doc.getText();
			syntaxTree = this.parse(txt,"\n");
			verified.ed.edit(editBuilder => { this.renumber(ext_sel,updateAll=='update all references',syntaxTree,mapping,editBuilder); });	
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

export class TokenizationTool extends lxbase.LangExtBase
{
	// Note on string encoding:
	// Because JavaScript uses UTF16, 8 bit binary data can be put directly into a string
	// with little trouble, since any value from 0-255 is mapped to exactly one code point.
	// We use the name `raw_str` to indicate that the string may contain binary data encoded
	// in this straightforward way.  When transferring to/from A2 memory images the
	// low bytes from the code points are put into a Uint8Array.
	// WARNING: text based manipulations are unsafe on `raw_str`.
	// The `persistentSpace` code is used to allow spaces to be safely stripped from `raw_str`.
	persistentSpace = String.fromCharCode(256);
	tokenizedProgram = "";
	tokenizedLine = "";
	currAddr = 2049;
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
	hex_from_raw_str(raw_str: string) : string
	{
		const rawBinary = new Uint8Array(this.buffer_from_raw_str(raw_str));
		return [...rawBinary].map(b => b.toString(16).toUpperCase().padStart(2,"0")).join("");
	}
	replace_curs(newNodeText: string, curs: Parser.TreeCursor) : string
	{
		const preNode = this.tokenizedLine.substring(0,curs.startPosition.column);
		const postNode = this.tokenizedLine.substring(curs.endPosition.column);
		return preNode + newNodeText + ' '.repeat(curs.nodeText.length-newNodeText.length) + postNode;
	}
	replace_node(newNodeText: string, node: Parser.SyntaxNode) : string
	{
		const preNode = this.tokenizedLine.substring(0,node.startPosition.column);
		const postNode = this.tokenizedLine.substring(node.endPosition.column);
		return preNode + newNodeText + ' '.repeat(node.text.length-newNodeText.length) + postNode;
	}
	replace_var_name(curs: Parser.TreeCursor) : string
	{
		const varRange = this.var_name_range(curs);
		const preNode = this.tokenizedLine.substring(0,varRange.start.character);
		const newNodeText = this.tokenizedLine.substring(varRange.start.character,varRange.end.character).toUpperCase();
		const postNode = this.tokenizedLine.substring(varRange.end.character);
		return preNode + newNodeText + postNode;
	}
	tokenize_node(curs: Parser.TreeCursor) : lxbase.WalkerChoice
	{
		// Primary line numbers "tokenized" as 16 bit integers separately
		// because here we require sizeof(new_node_data)<=sizeof(old_node_data)

		// Negative ASCII tokens
		if (curs.nodeType in tokenize_map)
			this.tokenizedLine = this.replace_curs(String.fromCharCode(Object(tokenize_map)[curs.nodeType] as number),curs);
		
		// Required upper case
		if (lxbase.VariableTypes.indexOf(curs.nodeType)>-1)
			this.tokenizedLine = this.replace_var_name(curs);
		if (['fn_name','real'].indexOf(curs.nodeType)>-1)
			this.tokenizedLine = this.replace_curs(curs.nodeText.toUpperCase(),curs);
		
		// Persistent spaces
		if (curs.nodeType=='statement')
		{
			const tok = curs.currentNode().firstNamedChild;
			if (tok)
			{
				// Text in the DATA statement is preserved unconditionally, so handle all at once and go out.
				// There is a problem with calculation of end of data in connection with quote parity that
				// cannot be solved in any satisfactory way (ROM handles it inconsistently).
				if (tok.type=='data_tok')
				{
					const preItems = this.tokenizedLine.substring(0,tok.endPosition.column);
					const items = this.tokenizedLine.substring(tok.endPosition.column,curs.endPosition.column);
					const postData = this.tokenizedLine.substring(curs.endPosition.column);
					this.tokenizedLine = preItems + items.replace(/ /g,this.persistentSpace) + postData;
					this.tokenizedLine = this.replace_node(String.fromCharCode(Object(tokenize_map)['data_tok'] as number),tok);
					return lxbase.WalkerOptions.gotoSibling;
				}
			}
		}
		if (curs.nodeType=='string' || curs.nodeType=='terminal_string')
			this.tokenizedLine = this.replace_curs(curs.nodeText.trim().replace(/ /g,this.persistentSpace),curs);
		if (curs.nodeType=='comment_text')
			this.tokenizedLine = this.replace_curs(curs.nodeText.replace(/ /g,this.persistentSpace),curs);
		
		return lxbase.WalkerOptions.gotoChild;
	}
	tokenize_line(curs: Parser.TreeCursor) : lxbase.WalkerChoice
	{
		if (curs.nodeType!="line")
			return lxbase.WalkerOptions.gotoChild;
		this.tokenizedLine = curs.nodeText;
		const lineTree = this.parse(this.tokenizedLine,'');
		this.walk(lineTree,this.tokenize_node.bind(this));
		const linenum = parseInt(this.tokenizedLine,10);
		const statements = this.tokenizedLine.
			replace(/[0-9]+/,'').
			trimEnd().
			replace(/ /g,'').
			replace(RegExp(this.persistentSpace,'g'),' ');
		this.currAddr += statements.length + 5;
		this.tokenizedLine = this.encode_int16(this.currAddr) + this.encode_int16(linenum) + statements + String.fromCharCode(0);
		this.tokenizedProgram += this.tokenizedLine;
		return lxbase.WalkerOptions.gotoSibling;
	}
	tokenize(syntaxTree: Parser.Tree,baseAddr: number) : string
	{
		this.tokenizedProgram = "";
		this.currAddr = baseAddr;
		this.walk(syntaxTree,this.tokenize_line.bind(this));
		this.tokenizedProgram += String.fromCharCode(0) + String.fromCharCode(0);
		return this.tokenizedProgram;
	}
	detokenize(img: Buffer) : string
	{
		let addr = img[103] + img[104]*256;
		let code = '\n';
		while ((img[addr]!=0 || img[addr+1]!=0) && addr<2**16) {
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
	appleWinSaveStateGo()
	{
		const verified = this.verify_document();
		if (!verified)
			return;
		const syntaxTree = this.parse(verified.doc.getText(),"\n");
		vscode.window.showOpenDialog({
			"canSelectMany": false,
			"canSelectFiles":true,
			"filters": {"Save state": ["yaml"]},
			"title": "Store in AppleWin State"
		}).then(uri => {
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
			const code = this.tokenize(syntaxTree,baseAddr);
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
			fs.writeFileSync(yamlPath,yamlTree.toString());
		});
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
	getAppleWinSaveState()
	{
		const verified = this.verify_document();
		if (!verified)
			return;
		const config = vscode.workspace.getConfiguration('applesoft');
		vscode.window.showOpenDialog({
			"canSelectMany": false,
			"canSelectFiles":true,
			"filters": {"Save state": ["yaml"]},
			"title": "Insert from AppleWin State"
		}).then(uri => {
			const [yamlTree,block64Map,yamlPath] = this.openAppleWinSaveState(uri);
			if (!yamlTree || !block64Map || !yamlPath)
				return;
			const buffList = new Array<Buffer>();
			for (const p of block64Map.items)
				buffList.push(Buffer.from(p.value.value,"hex"));
			const img = Buffer.concat(buffList);
			const code = this.detokenize(img);
			if (code.length>1)
				verified.ed.edit( edit => { edit.replace(verified.ed.selection,code); });
			else
				vscode.window.showWarningMessage('no program was found to insert');
		});
	}
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
		process.on('close',(code) => {
			if (code===0)
			{
				const img = fs.readFileSync(dumpPath);
				const code = this.detokenize(img);
				if (code.length>1)
					verified.ed.edit( edit => { edit.replace(verified.ed.selection,code); });
				else
					vscode.window.showWarningMessage('no program was found to insert');
			}
		});
	}
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
		const syntaxTree = this.parse(verified.doc.getText(),"\n");
		const code = this.tokenize(syntaxTree,baseAddr);
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
}

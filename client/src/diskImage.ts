import * as vscode from 'vscode';
import * as lxbase from './langExtBase';
import { spawn } from 'child_process';
import * as vsclnt from 'vscode-languageclient';
import { client } from './extension';

function abortMessage() {
	vscode.window.showInformationMessage('disk image operation aborted by user');
}

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
			ext_end = textEditor.document.lineAt(sel.end.line-1).range.end;
		else
			ext_end = textEditor.document.lineAt(sel.end.line).range.end;
		return new vscode.Range(ext_start,ext_end);
	}
	return undefined;
}

/**
 * This module works by setting up a chain of callbacks that are invoked
 * upon successful completion of an a2kit subprocess.  Each link in the chain
 * is hard coded to the next link.
 */
export class A2KitTool extends lxbase.LangExtBase
{
	operation = "get";
	resultString = "";
	resultBytes: Buffer = Buffer.from("");
	fsPath = "";
	imgPath = [""]; // path for each depth traversed, volume prefix is assumed
	file_list: string[] = [];
	addr: string | undefined = undefined;
	/**
	 * Run a2kit expecting to receive binary output
	 *
	 * @param args the a2kit arguments 
	 * @param resolve the callback to run when the subprocess closes
	 * @param stdin the optional string that is piped in
	 */
	a2kit_txt2bin(args: string[], resolve: (bin: Buffer) => void, stdin: string|undefined) {
		this.resultBytes = Buffer.from("");
		const process = spawn('a2kit', args, { timeout: 10000 });
		if (stdin) {
			process.stdin.write(stdin);
			process.stdin.end();
		}
		process.stderr.on('data', async (data) => {
			vscode.window.showErrorMessage(`a2kit says ${data}`);
		});
		process.stdout.on('data', async (data) => {
			this.resultBytes = Buffer.concat([this.resultBytes,data]);
		});
		process.on('error', async (err) => {
			vscode.window.showErrorMessage("error spawning a2kit, is it installed and in the path?");
		});
		process.on('close', async (exitCode) => {
			if (exitCode == 0) {
				resolve(this.resultBytes);
			}
		});
	}
	/**
	 * Run a2kit expecting to receive text output
	 *
	 * @param args the a2kit arguments 
	 * @param resolve the callback to run when the subprocess closes
	 * @param stdin the optional binary data that is piped in
	 */
	a2kit_bin2txt(args: string[], resolve: (txt: string) => void, stdin: Buffer|undefined) {
		this.resultString = "";
		const process = spawn('a2kit', args, { timeout: 10000 });
		if (stdin) {
			process.stdin.write(stdin);
			process.stdin.end();
		}
		process.stderr.on('data', async (data) => {
			vscode.window.showErrorMessage(`a2kit says ${data}`);
		});
		process.stdout.on('data', async (data) => {
			const str_output = `${data}`;
			this.resultString += str_output;
		});
		process.on('error', async (err) => {
			vscode.window.showErrorMessage("error spawning a2kit, is it installed and in the path?");
		});
		process.on('close', async (exitCode) => {
			if (exitCode == 0) {
				resolve(this.resultString);
			}
		});
	}
	/**
	 * Parse a disk catalog to extract directories and Applesoft files
	 * @param catalog the disk catalog with the file system's formatting
	 * @returns two arrays, first with directories, second with Applesoft files
	 */
	parse_catalog(catalog: string): [string[], string[]] | undefined {
		const dirs = Array<string>();
		const files = Array<string>();
		const lines = catalog.split(/\r?\n/);
		if (lines.length>3 && lines[1].length>11 && lines[1].substring(0, 11) == "DISK VOLUME") {
			for (const line of lines.slice(3)) {
				if (line.length>7 && line[1] == "A") {
					files.push("(BAS)  "+line.slice(7));
				}
			}
			return [dirs, files];
		}
		if (lines.length>5 && lines[3].length>21 && lines[3].substring(0, 21) == " NAME            TYPE") {
			for (const line of lines.slice(5)) {
				if (line.length>20 && line.substring(17,20) == "DIR") {
					dirs.push("(DIR)  "+line.slice(1,15).trim());
				}
				if (line.length>20 && line.substring(17,20) == "BAS") {
					files.push("(BAS)  "+line.slice(1,15).trim());
				}
			}
			return [dirs, files];
		}
		return undefined;
	}
	async insert_code(txt: string) {
		const verified = this.verify_document();
		if (verified) {
			verified.ed.edit(edit => { edit.replace(verified.ed.selection, txt); });
		}
	}
	finish_put(txt: string) {
		vscode.window.showInformationMessage(this.imgPath[this.imgPath.length-1]+" saved to disk image");
	}
	async save_code(buf: Buffer) {
		this.a2kit_bin2txt(["put", "-d", this.fsPath, "-f", this.imgPath[this.imgPath.length - 1], "-t", "atok"], this.finish_put.bind(this), buf);
	}
	check_addr(addr: string): null | string {
		const num = parseInt(addr);
		if (!num)
			return 'address should be a number';
		if (num<2049 || num>49143)
			return 'address is out of range (2049 - 49143)';
		return null;
	}
	async tokenize(dummy: string) {
		const verified = this.verify_document();
		if (this.addr && verified) {
			const code: number[] = await client.sendRequest(vsclnt.ExecuteCommandRequest.type,
				{
					command: 'applesoft.tokenize',
					arguments: [verified.doc.getText(), parseInt(this.addr)]
				});
			this.save_code(Buffer.from(Uint8Array.from(code)));
		}
		else
			vscode.window.showErrorMessage("could not find document tokenize");
	}
	async detokenize(tokens: Buffer) {
		const img_messg = new Array<number>(65536);
		const prog_bytes = Array.from(Uint8Array.from(tokens));
		// load address is not important, so long as it puts program beyond the pointer
		img_messg[103] = 0;
		img_messg[104] = 1;
		for (let i = 0; i < prog_bytes.length; i++) {
			img_messg[256 + i] = prog_bytes[i];
		}
		const code = await client.sendRequest(vsclnt.ExecuteCommandRequest.type,
			{
				command: 'applesoft.detokenize',
				arguments: img_messg
			});
		this.insert_code(code);
	}
	async runOperation() {
		if (this.operation == "get") {
			this.a2kit_txt2bin(["get", "-d", this.fsPath, "-f", this.imgPath[this.imgPath.length - 1], "-t", "atok"], this.detokenize.bind(this), undefined);
		} else if (this.operation == "put") {
			let existingFilesPrompt = "existing files: ";
			if (this.file_list.length == 0)
				existingFilesPrompt += "none";
			else
				existingFilesPrompt += this.file_list[0];
			for (let i = 1; i < this.file_list.length; i++) {
				existingFilesPrompt += ", " + this.file_list[i];
			}
			let fname = await vscode.window.showInputBox({ title: "enter filename", prompt: existingFilesPrompt });
			if (!fname)
				return;
			fname = fname.toUpperCase();
			this.imgPath.push(this.imgPath[this.imgPath.length - 1] + fname);
			if (this.file_list.includes(fname)) {
				const result = await vscode.window.showWarningMessage(fname + ' already exists', 'Overwrite', 'Cancel');
				if (result == 'Cancel') {
					abortMessage();
					return;
				}
				this.a2kit_bin2txt(["delete", "-d", this.fsPath, "-f", this.imgPath[this.imgPath.length - 1]], this.tokenize.bind(this), undefined);
				return;
			}
			this.tokenize("");
		} else {
			vscode.window.showErrorMessage("unknown disk image operation " + this.operation);
		}
	}
	async select(raw_catalog: string) {
		const catalog = this.parse_catalog(raw_catalog);
		if (!catalog) {
			vscode.window.showErrorMessage('could not parse disk catalog, raw data: '+raw_catalog);
			return;
		}
		const [dirs, files] = catalog;
		this.file_list = [];
		for (const file of files)
			this.file_list.push(file.substring(7));
		if (this.operation=="get" && dirs.length == 0 && files.length == 0 && this.imgPath.length == 1) {
			vscode.window.showErrorMessage('no applesoft program files or directories were found, raw data: '+raw_catalog);
			return;
		}
		if (this.operation == "put" && dirs.length == 0 && this.imgPath.length == 1) {
			this.runOperation();
			return;
		}
		const choices = Array<string>();
		if (this.operation == "put")
			choices.push("(DIR)  .");
		if (this.imgPath.length > 1)
			choices.push("(DIR)  ..");
		if (this.operation == "get")
			for (const file of files)
				choices.push(file);
		for (const dir of dirs)
			choices.push(dir);
		const fname = await vscode.window.showQuickPick(choices, { canPickMany: false, title: this.operation=="get" ? 'select file' : 'select directory' });
		if (fname && fname == "(DIR)  ..") {
			this.imgPath.pop();
			this.recursiveSelection();
		} else if (fname && fname == "(DIR)  .") {
			this.runOperation();
		} else if (fname && fname.substring(0, 7) == "(DIR)  ") {
			this.imgPath.push(this.imgPath[this.imgPath.length - 1] + fname.substring(7) + "/");
			this.recursiveSelection();
		} else if (fname && fname.substring(0, 7) == "(BAS)  ") {
			this.imgPath.push(this.imgPath[this.imgPath.length - 1] + fname.substring(7));
			this.runOperation();
		} else if (!fname) {
			abortMessage();
		} else {
			vscode.window.showErrorMessage("unhandled selection " + fname);
		}
	}
	async recursiveSelection() {
		if (this.imgPath.length == 1)
			this.a2kit_bin2txt(["catalog", "-d", this.fsPath], this.select.bind(this), undefined);
		else
			this.a2kit_bin2txt(["catalog", "-d", this.fsPath, "-f", this.imgPath[this.imgPath.length-1]], this.select.bind(this), undefined);
	}
	async getApplesoftFile() {
		const uri = await vscode.window.showOpenDialog({
			"canSelectMany": false,
			"canSelectFiles": true,
			"filters": { "Disk image": ["2mg", "2img", "dsk", "do", "d13", "nib", "po", "woz"] },
			"title": "Insert from Disk Image"
		});
		if (!uri) {
			abortMessage();
			return;
		}
		this.operation = "get";
		this.fsPath = uri[0].fsPath;
		this.imgPath = [""];
		this.recursiveSelection();
	}
	async putApplesoftFile() {
		this.addr = await vscode.window.showInputBox({
			title: "load address",
			value: "2049",
			validateInput: tst => { return this.check_addr(tst); }
		});
		if (!this.addr)
			return;
		const uri = await vscode.window.showOpenDialog({
			"canSelectMany": false,
			"canSelectFiles": true,
			"filters": { "Disk image": ["2mg", "2img", "dsk", "do", "d13", "nib", "po", "woz"] },
			"title": "Save to Disk Image"
		});
		if (!uri) {
			abortMessage();
			return;
		}
		this.operation = "put";
		this.fsPath = uri[0].fsPath;
		this.imgPath = [""];
		this.recursiveSelection();
	}
}


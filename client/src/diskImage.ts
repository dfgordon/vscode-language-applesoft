import * as vscode from 'vscode';
import * as lxbase from './langExtBase';

const FNAME_START = 12;
const ABORT_MESS = "disk image operation aborted by user";

/**
 * This object sends requests to the server for disk image data.
 * The a2kit library is now bundled with the server, so there is no
 * need to run the a2kit CLI in a subprocess anymore.
 */
export class A2KitTool extends lxbase.LangExtBase {
	operation = "get";
	resultString = "";
	resultBytes: Buffer = Buffer.from("");
	imgPath = [""]; // path for each depth traversed, volume prefix is assumed
	file_list: string[] = [];
	currPath(): string {
		return this.imgPath[this.imgPath.length - 1];
	}
	getExisting(lst: string[]): string[] {
		const ans = new Array<string>()
		for (const s of lst) {
			ans.push(s.substring(FNAME_START));
		}
		return ans;
	}
	async insert_code(txt: string) {
		const verified = lxbase.verify_document();
		if (verified) {
			verified.ed.edit(edit => { edit.replace(verified.ed.selection, txt); });
		}
	}
	check_addr(addr: string): null | string {
		const num = parseInt(addr);
		if (!num)
			return 'address should be a number';
		if (num<2049 || num>49143)
			return 'address is out of range (2049 - 49143)';
		return null;
	}
	/** update this.imgPath based on the user selection.
	 * return value is true if we need to keep selecting, false otherwise.
	 * throws an error if user aborts or there is an unexpected selection. */
	async select(rows: Array<string>): Promise<boolean> {
		if (this.operation == "put" && rows.length == 0 && this.imgPath.length == 1) {
			return false;
		}
		const dotRow = "DIR" + " ".repeat(9) + ".";
		const dotDotRow = "DIR" + " ".repeat(9) + "..";
		const choices = Array<string>();
		if (this.operation == "put")
			choices.push(dotRow);
		if (this.imgPath.length > 1)
			choices.push(dotDotRow);
		for (const row of rows)
			if (row.startsWith("DIR"))
				choices.push(row);
		for (const row of rows)
			if (!row.startsWith("DIR"))
				choices.push(row);
		const fname = await vscode.window.showQuickPick(choices, { canPickMany: false, title: this.operation == "get" ? 'select file' : 'select directory' });
		if (fname && fname == dotDotRow) {
			this.imgPath.pop();
			return true;
		} else if (fname && fname == dotRow) {
			return false
		} else if (fname && fname.startsWith("DIR")) {
			this.imgPath.push(this.currPath() + fname.substring(FNAME_START) + "/");
			return true;
		} else if (fname && fname.startsWith("BAS")) {
			this.imgPath.push(this.currPath() + fname.substring(FNAME_START));
			return false;
		} else if (!fname) {
			throw new Error("aborted");
		} else {
			throw new Error("unhandled selection");
		}
	}
	async getApplesoftFile() {
		const uri = await vscode.window.showOpenDialog({
			"canSelectMany": false,
			"canSelectFiles": true,
			"filters": { "Disk image": ["2mg", "2img", "dsk", "do", "d13", "nib", "po", "woz"] },
			"title": "Insert from Disk Image"
		});
		if (!uri) {
			vscode.window.showInformationMessage(ABORT_MESS);
			return;
		}
		try {
			await lxbase.request<null>("applesoft.disk.mount", [uri[0].fsPath]);
	
			this.operation = "get";
			this.imgPath = [""];
			
			let response: string[] | string = await lxbase.request<Array<string>>("applesoft.disk.pick", [this.currPath(),["bas"]]);
			if (response.length==0) {
				vscode.window.showErrorMessage('no applesoft program files or directories were found');
				return;
			}
	
			let selecting;
			do {
				selecting = await this.select(response);
				if (selecting) {
					response = await lxbase.request<Array<string>>("applesoft.disk.pick", [this.currPath(), ["bas"]]);
				}
			} while (selecting);
			response = await lxbase.request<string>("applesoft.disk.pick", [this.currPath(), ["bas"]]);
			this.insert_code(response);
		} catch (error) {
			if (error instanceof Error) {
				if (error.message == "aborted")
					vscode.window.showInformationMessage(ABORT_MESS);
				else
					vscode.window.showErrorMessage(error.message);
			}
		}
	}
	async putApplesoftFile() {
		const addr = await vscode.window.showInputBox({
			title: "load address",
			value: "2049",
			validateInput: tst => { return this.check_addr(tst); }
		});
		if (!addr)
			return;
		const uri = await vscode.window.showOpenDialog({
			"canSelectMany": false,
			"canSelectFiles": true,
			"filters": { "Disk image": ["2mg", "2img", "dsk", "do", "d13", "nib", "po", "woz"] },
			"title": "Save to Disk Image"
		});
		if (!uri) {
			vscode.window.showInformationMessage(ABORT_MESS);
			return;
		}

		try {
			await lxbase.request<null>("applesoft.disk.mount", [uri[0].fsPath]);
	
			this.operation = "put";
			this.imgPath = [""];
			
			let response = await lxbase.request<string[]>("applesoft.disk.pick", [this.currPath(),[]]);
			let selecting;
			do {
				selecting = await this.select(response);
				response = await lxbase.request<string[]>("applesoft.disk.pick", [this.currPath(),[]]);
			} while (selecting);

			response = await lxbase.request<string[]>("applesoft.disk.pick", [this.currPath(), null]);
			const existingFileList = this.getExisting(response);
			let existingFilesPrompt = "existing files: ";
			if (existingFileList.length == 0)
				existingFilesPrompt += "none";
			else
				existingFilesPrompt += existingFileList[0];
			for (let i = 1; i < existingFileList.length; i++) {
				existingFilesPrompt += ", " + existingFileList[i];
			}
			let fname = await vscode.window.showInputBox({ title: "enter filename", prompt: existingFilesPrompt });
			if (!fname) {
				vscode.window.showInformationMessage(ABORT_MESS);
				return;
			}
			fname = fname.toUpperCase();
			this.imgPath.push(this.currPath() + fname);
			if (existingFileList.includes(fname)) {
				const result = await vscode.window.showWarningMessage(fname + ' already exists', 'Overwrite', 'Cancel');
				if (result == 'Cancel') {
					vscode.window.showInformationMessage(ABORT_MESS);
					return;
				}
				await lxbase.request<null>("applesoft.disk.delete", [this.currPath()]);
			}
			const verified = lxbase.verify_document();
			if (!verified) {
				vscode.window.showErrorMessage("document not found");
				return;
			}
			await lxbase.request<null>("applesoft.disk.put", [this.currPath(), verified.doc.getText(), parseInt(addr)]);
			vscode.window.showInformationMessage(this.currPath()+" saved to disk image");
		} catch (error) {
			if (error instanceof Error) {
				if (error.message == "aborted")
					vscode.window.showInformationMessage(ABORT_MESS);
				else
					vscode.window.showErrorMessage(error.message);
			}
		}
	}
}

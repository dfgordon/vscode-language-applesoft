import Parser from 'web-tree-sitter';
import * as vsserv from 'vscode-languageserver';
import * as lxbase from './langExtBase';
import * as detokenize_map from './detokenize_map.json';
import * as tokenize_map from './tokenize_map.json';
import * as guard_map from './short_var_guards.json';

export class Minifier extends lxbase.LangExtBase {
	workingLine = '';
	minifiedProgram = '';
	// since the program is supposed to be ASCII, we can use a non-ASCII
	// character to encode spaces we need to keep (e.g. in comments and strings)
	persistentSpace = String.fromCharCode(256);
	replace_curs(newNodeText: string, curs: Parser.TreeCursor) : string
	{
		const preNode = this.workingLine.substring(0,curs.startPosition.column);
		const postNode = this.workingLine.substring(curs.endPosition.column);
		return preNode + newNodeText + ' '.repeat(curs.nodeText.length-newNodeText.length) + postNode;
	}
	/// figure out if the short name needs to be guarded against forming a hidden token
	needs_guard(clean_str: string, curs: Parser.TreeCursor): boolean {
		const shortStr = clean_str.substring(0, 2).toLowerCase();
		const cannot_follow = Object(guard_map)[shortStr];
		let parent = curs.currentNode().parent;
		if (!parent)
			return false;
		while (!parent.nextNamedSibling) {
			if (!parent.parent)
				return false;
			parent = parent.parent;
		}
		const next = parent.nextNamedSibling;
		if (next && cannot_follow)
			if (cannot_follow.includes(next.type))
				return true;
		return false;
	}
	minify_node(curs: Parser.TreeCursor): lxbase.WalkerChoice {

		// Shorten variable names
		if (curs.nodeType.substring(0, 5) == 'name_') {
			const txt = curs.nodeText.replace(/ /g, '');
			if (txt.length > 3 && (curs.nodeType=='name_str' || curs.nodeType=='name_int'))
				this.workingLine = this.replace_curs(txt.substring(0, 2) + txt.slice(-1), curs);
			if (txt.length > 2 && curs.nodeType != 'name_str' && curs.nodeType != 'name_int') {
				if (!this.needs_guard(txt,curs)) {
					this.workingLine = this.replace_curs(txt.substring(0, 2), curs);
				}
				else {
					// if it is longer than 4 characters we gain something by guarding with parenthesis
					if (txt.length > 4) {
						this.workingLine = this.replace_curs("(" + txt.substring(0, 2) + ")", curs);
					}
					// otherwise do not change it
				}
			}
		}
	
		// Strip comment text, leaving REM token
		if (curs.nodeType == 'comment_text')
			this.workingLine = this.replace_curs('', curs); // OK even if statement was dropped
	
		// Persistent spaces, REM, ampersand, and unquotes
		if (curs.nodeType == 'statement') {
			const tok = curs.currentNode().firstNamedChild;
			if (tok) {
				if (tok.type == 'tok_rem') {
					// we can drop whole REM statement if the line has other statements
					const prev = curs.currentNode().previousNamedSibling;
					if (prev && prev.type == 'statement')
						this.workingLine = this.replace_curs('', curs);
				}
				// Text in the DATA statement is preserved unconditionally, so handle all at once and go out.
				// There is a problem with calculation of end of data in connection with quote parity that
				// cannot be solved in any satisfactory way (ROM handles it inconsistently).
				// For ampersand, we treat the same as DATA (do not perturb) for now.
				if (tok.type == 'tok_data' || tok.type == 'tok_amp') {
					const preItems = this.workingLine.substring(0, tok.endPosition.column);
					const items = this.workingLine.substring(tok.endPosition.column, curs.endPosition.column);
					const postData = this.workingLine.substring(curs.endPosition.column);
					this.workingLine = preItems + items.replace(/ /g, this.persistentSpace) + postData;
					return lxbase.WalkerOptions.gotoSibling;
				}
			}
		}
		if (curs.nodeType == 'tok_at') {
			// deal with ATO and ATN, could be more aggressive
			const tok = curs.currentNode();
			if (this.workingLine.substring(tok.endPosition.column, tok.endPosition.column + 1) == " ") {
				const preSpc = this.workingLine.substring(0, tok.endPosition.column);
				const postSpc = this.workingLine.substring(curs.endPosition.column + 1);
				this.workingLine = preSpc + this.persistentSpace + postSpc;
				return lxbase.WalkerOptions.gotoSibling;
			}
		}
		if (curs.nodeType == 'str' && (curs.nodeText[curs.nodeText.length - 1] != '"' || curs.nodeText.length == 1)) {
			// if the the string already has no unquote intercept here and go out
			this.workingLine = this.replace_curs(curs.nodeText.trimStart().replace(/ /g, this.persistentSpace), curs);
			return lxbase.WalkerOptions.gotoSibling;
		}
		if (curs.nodeType == 'str') {
			let persistentSpaceStr = curs.nodeText.trim().replace(/ /g, this.persistentSpace);
			// check to see if there are trailing nodes at any level up to line, if no, strip the last character
			let curr: Parser.SyntaxNode | null = curs.currentNode();
			while (curr && curr.type != "line") {
				const next = curr.nextSibling;
				if (next) {
					this.workingLine = this.replace_curs(persistentSpaceStr, curs);
					return lxbase.WalkerOptions.gotoSibling;
				}
				curr = curr.parent;
			}
			persistentSpaceStr = persistentSpaceStr.substring(0, persistentSpaceStr.length - 1);
			this.workingLine = this.replace_curs(persistentSpaceStr, curs);
			return lxbase.WalkerOptions.gotoSibling;
		}

		// Extraneous separators
		if (!curs.nodeIsNamed && curs.nodeText == ':') {
			// if there is a colon after this, or nothing after this, remove it
			const next = curs.currentNode().nextSibling;
			if (next && !next.isNamed() && next.text==':' || !next)
				this.workingLine = this.replace_curs(' ', curs);
		}
		return lxbase.WalkerOptions.gotoChild;
	}
	minify_line(curs: Parser.TreeCursor): lxbase.WalkerChoice {
		if (curs.nodeType != "line")
			return lxbase.WalkerOptions.gotoChild;
		this.workingLine = curs.nodeText;
		let lastIter = this.workingLine;
		do {
			lastIter = this.workingLine;
			const lineTree = this.parse(this.workingLine, '');
			this.walk(lineTree, this.minify_node.bind(this));
			this.workingLine = this.workingLine.
				trimEnd().
				replace(/ /g, '').
				replace(RegExp(this.persistentSpace, 'g'), ' ');
		} while (this.workingLine != lastIter);
		this.minifiedProgram += this.workingLine + '\n';
		return lxbase.WalkerOptions.gotoSibling;
	}
	minify(program: string): string {
		this.minifiedProgram = "";
		const syntaxTree = this.parse(program, '\n');
		this.walk(syntaxTree, this.minify_line.bind(this));
		return this.minifiedProgram;
	}
}

export class Tokenizer extends lxbase.LangExtBase
{
	err = new Array<string>();
	lineText = "";
	tokenizedLine = new Array<number>();
	currAddr = 2049;
	encode_int16(int16: number) : [number,number]
	{
		const loByte = int16 % 256;
		const hiByte = Math.floor(int16 / 256);
		return [loByte,hiByte];
	}
	stringlike_node_to_bytes(txt: string,trim: boolean): number[] {
		const trimmed = trim ? txt.trimStart().toString() : txt;
		return lxbase.escaped_string_to_bytes(trimmed);
	}
	tokenize_node(curs: Parser.TreeCursor) : lxbase.WalkerChoice
	{
		// Primary line number
		if (curs.nodeType == "linenum") {
			const parent = curs.currentNode().parent;
			if (parent?.type=="line") {
				const val = parseInt(curs.nodeText.replace(/ /g,''));
				const bytes = this.encode_int16(val);
				this.tokenizedLine.push(bytes[0]);
				this.tokenizedLine.push(bytes[1]);
				return lxbase.WalkerOptions.gotoSibling;
			}
		}
		// Anonymous nodes
		if (!curs.nodeIsNamed) {
			const cleaned = curs.nodeText.toUpperCase().replace(/ /g, "");
			this.tokenizedLine.push(...Buffer.from(cleaned));
			return lxbase.WalkerOptions.gotoSibling;
		}
		// Negative ASCII tokens
		if (curs.nodeType in tokenize_map) {
			this.tokenizedLine.push(Object(tokenize_map)[curs.nodeType] as number);
			return lxbase.WalkerOptions.gotoSibling;
		}
		// Required upper case
		if (curs.nodeType.substring(0,5)=='name_' || curs.nodeType=='real') {
			if (curs.nodeType=="name_amp" && curs.currentNode().childCount>0) {
				// handle overloaded tokens
				return lxbase.WalkerOptions.gotoChild;
			}
			const cleaned = curs.nodeText.toUpperCase().replace(/ /g,"");
			this.tokenizedLine.push(...Buffer.from(cleaned));
			return lxbase.WalkerOptions.gotoSibling;
		}
		// Persistent spaces and escapes
		if (curs.nodeType == "statement") {
			const tok = curs.currentNode().firstNamedChild;
			if (tok && tok.type=="tok_data") {
				// Text in the DATA statement is preserved unconditionally, so handle all at once and go out.
				// There is a problem with calculation of end of data in connection with quote parity that
				// cannot be solved in any satisfactory way (ROM handles it inconsistently).
				const items = this.stringlike_node_to_bytes(this.lineText.substring(tok.endPosition.column, curs.endPosition.column),false);
				this.tokenizedLine.push(Object(tokenize_map)['tok_data'] as number);
				this.tokenizedLine.push(...items);
				return lxbase.WalkerOptions.gotoSibling;
			}
		}
		if (curs.nodeType=="str") {
			this.tokenizedLine.push(...this.stringlike_node_to_bytes(curs.nodeText,true));
			return lxbase.WalkerOptions.gotoSibling;
		}
		if (curs.nodeType=="comment_text") {
			this.tokenizedLine.push(...this.stringlike_node_to_bytes(curs.nodeText,false));
			return lxbase.WalkerOptions.gotoSibling;
		}

		// If none of the above, look for terminal nodes and strip spaces
		if (curs.currentNode().namedChildCount==0) {
			const cleaned = curs.nodeText.replace(/ /g,"");
			this.tokenizedLine.push(...Buffer.from(cleaned));
			return lxbase.WalkerOptions.gotoSibling;
		}

		return lxbase.WalkerOptions.gotoChild;
	}
	tokenize_line(line: string)
	{
		this.tokenizedLine = [];
		this.lineText = line;
		const lineTree = this.parse(line,'\n');
		this.walk(lineTree, this.tokenize_node.bind(this));
		const nextAddr = this.currAddr + this.tokenizedLine.length + 3;
		const completed = this.encode_int16(nextAddr);
		completed.push(...this.tokenizedLine);
		completed.push(0);
		this.tokenizedLine = completed;
		this.currAddr = nextAddr;
	}
	tokenize(program: string,baseAddr: number) : number[]
	{
		this.err = [];
		const lines = program.split(/\r?\n/);
		const tokenizedProgram = [];
		this.currAddr = baseAddr;
		for (const line of lines) {
			if (line.trim().length == 0) {
				continue;
			}
			this.tokenize_line(line);
			tokenizedProgram.push(...this.tokenizedLine);
		}
		if (this.err.length > 0)
			return [];
		tokenizedProgram.push(0);
		tokenizedProgram.push(0);
		return tokenizedProgram;
	}
	detokenize(img: number[]) : string
	{
		const DATA_TOK = 131;
		const REM_TOK = 178;
		const QUOTE = 34;
		const COLON = 58;
		let addr = img[103] + img[104]*256;
		let code = '';
		let lineCount = 0;
		while (addr<2**16-3 && (img[addr]!=0 || img[addr+1]!=0) && lineCount<this.config.detokenizer.maxLines) {
			addr += 2; // skip link address
			const line_num = img[addr] + img[addr+1]*256;
			code += line_num.toString() + ' ';
			addr += 2;
			let escaped = "";
			const lineAddr = addr;
			while (addr<2**16 && img[addr] != 0 && addr<lineAddr+this.config.detokenizer.maxLineLength) {
				if (img[addr] == QUOTE) {
					code += "\"";
					[escaped, addr] = lxbase.bytes_to_escaped_string(
						this.config.detokenizer.escapes, img, addr + 1, [QUOTE, 0], "str");
					code += escaped;
					if (img[addr] == QUOTE) {
						code += "\"";
						addr += 1;
					}
				}
				else if (img[addr] == REM_TOK) {
					code += ' REM ';
					[escaped, addr] = lxbase.bytes_to_escaped_string(
						this.config.detokenizer.escapes, img, addr + 1, [0], "tok_rem");
					code += escaped;
				}
				else if (img[addr] == DATA_TOK) {
					code += ' DATA ';
					[escaped, addr] = lxbase.bytes_to_escaped_string(
						this.config.detokenizer.escapes, img, addr + 1, [COLON, 0], "tok_data");
					code += escaped;
				}
				else if (img[addr] > 127) {
					const tok = Object(detokenize_map)[img[addr].toString()];
					if (tok)
						code += ' ' + tok.toUpperCase() + ' ';
					else
						code += '\ufffd';
					addr += 1;
				} else {
					code += String.fromCharCode(img[addr]);
					addr += 1;
				}
			}
			lineCount += 1;
			code += '\n';
			addr += 1;
		}
		return code;
	}
}

/**
 * information about line number labels packed into arrays ordered by the
 * order of appearance in the document.  The array length should be considered
 * unrelated to count of lines in document.
 */
export class LabelInformation {
	nums = new Array<number>();
	rngs = new Array<vsserv.Range>();
	leading_space = new Array<number>();
	trailing_space = new Array<number>();
}

export class LineNumberTool extends lxbase.LangExtBase
{
	lineInfo = new LabelInformation();
	clear() {
		this.lineInfo = new LabelInformation();
	}
	push_linenum(curs: Parser.TreeCursor)
	{
		const rng = lxbase.curs_to_range(curs,0);
		const leading = curs.nodeText.length - curs.nodeText.trimStart().length;
		const trailing = curs.nodeText.length - curs.nodeText.trimEnd().length;
		const parsed = parseInt(curs.nodeText.replace(/ /g,''));
		if (!isNaN(parsed))
		{
			this.lineInfo.nums.push(parsed);
			this.lineInfo.rngs.push(rng);
			this.lineInfo.leading_space.push(leading);
			this.lineInfo.trailing_space.push(trailing);
		}
	}
	visitPrimaryLineNumber(curs:Parser.TreeCursor) : lxbase.WalkerChoice
	{
		const parent = curs.currentNode().parent;
		if (curs.nodeType=="linenum" && parent)
			if (parent.type=="line")
			{
				this.push_linenum(curs);
				return lxbase.WalkerOptions.gotoParentSibling;
			}
		return lxbase.WalkerOptions.gotoChild;
	}
	visitSecondaryLineNumber(curs:Parser.TreeCursor) : lxbase.WalkerChoice
	{
		const parent = curs.currentNode().parent;
		if (curs.nodeType=="linenum" && parent)
			if (parent.type!="line")
			{
				this.push_linenum(curs);
				return lxbase.WalkerOptions.gotoSibling;
			}
		return lxbase.WalkerOptions.gotoChild;
	}
	/**
	 * Gathers information about primary line numbers
	 * @param tree syntax tree to analyze
	 * @returns line information structure
	 */
	get_primary_nums(tree: Parser.Tree) : LabelInformation
	{
		this.clear();
		this.walk(tree,this.visitPrimaryLineNumber.bind(this));
		return this.lineInfo;
	}
	/**
	 * Gathers information about secondary line numbers
	 * @param tree syntax tree to analyze
	 * @returns line information structure
	 */
	get_secondary_nums(tree: Parser.Tree) : LabelInformation
	{
		this.clear();
		this.walk(tree,this.visitSecondaryLineNumber.bind(this));
		return this.lineInfo;
	}
	/**
	 * Add the edits to change the line labels
	 * @param i index into the label information
	 * @param info line label information, any scope
	 * @param mapping old line label to new line label
	 * @param edits array of edits to be updated
	 */
	apply_mapping(i: number,info: LabelInformation, mapping: Map<number,number>,edits: Array<vsserv.TextEdit>) {
		const new_num =  mapping.get(info.nums[i]);
		if (new_num!=undefined)
		{
			let fmt_num = ' '.repeat(info.leading_space[i]);
			fmt_num += new_num.toString();
			fmt_num += ' '.repeat(info.trailing_space[i]);
			edits.push(vsserv.TextEdit.replace(info.rngs[i], fmt_num));
		}
	}
	/**
	 * Get the next updated line starting from the given line label index.
	 * This is needed when there are overlaps, which cannot be handled by returning
	 * edits to the client.
	 * @param lines the text of the lines involved
	 * @param i0 index into the label information where the search is started
	 * @param currLine line index (not the line label)
	 * @param info line label information
	 * @param mapping old line label to new line label
	 * @returns [next i0, the updated line]
	 */
	next_updated_line(lines: string[], i0: number, currLine: number, info: LabelInformation, mapping: Map<number, number>): [number, string] | null {
		let offset = 0;
		if (i0 >= info.rngs.length)
			return null;
		let updated = lines[currLine];
		let i = i0;
		while (i < info.rngs.length && info.rngs[i].start.line == currLine) {
			const new_num = mapping.get(info.nums[i]);
			if (new_num!=undefined)
			{
				let fmt_num = ' '.repeat(info.leading_space[i]);
				fmt_num += new_num.toString();
				fmt_num += ' '.repeat(info.trailing_space[i]);
				updated = updated.substring(0, info.rngs[i].start.character + offset) + fmt_num + updated.substring(info.rngs[i].end.character + offset);
				offset += fmt_num.length - info.rngs[i].end.character + info.rngs[i].start.character;
			}
			i += 1;
		}
		return [i, updated];
	}
	/** Renumber lines without disturbing the order of the lines
	 * @returns [edit object | undefined , error message]
	 */
	renumber(doc: vsserv.TextDocumentItem, ext_sel: vsserv.Range | null, start: string, step: string, updateRefs: boolean):
		[vsserv.TextDocumentEdit | undefined,string] {
		const l0 = parseInt(start);
		const dl = parseInt(step);
		if (isNaN(l0) || isNaN(dl) || l0<0 || dl<1)
			return [undefined,'start and step parameters invalid'];
		let lower_guard = undefined;
		let upper_guard = undefined;
		const all_txt = doc.text;
		let sel_txt = all_txt;
		const lines = all_txt.split(/\r?\n/);
		if (ext_sel)
		{
			let l = ext_sel.start.line - 1;
			while (l>=0 && !lower_guard)
			{
				const matches = lines[l].match(/^\s*[0-9 ]+/);
				if (matches)
					lower_guard = parseInt(matches[0])+1;
				l--;
			}
			l = ext_sel.end.line + 1;
			while (l<lines.length && !upper_guard)
			{
				const matches = lines[l].match(/^\s*[0-9 ]+/);
				if (matches)
					upper_guard = parseInt(matches[0])-1;
				l++;
			}
			sel_txt = '';
			for (l = ext_sel.start.line; l <= ext_sel.end.line; l++)
				sel_txt += lines[l] + '\n';
		}
		let syntaxTree = this.parse(sel_txt,"\n");
		const sel_info = this.get_primary_nums(syntaxTree);
		syntaxTree = this.parse(all_txt, "\n");
		const all_info = this.get_primary_nums(syntaxTree);
		const ref_info = this.get_secondary_nums(syntaxTree);
		const lN = l0 + dl*(sel_info.nums.length-1);
		if (!lower_guard)
			lower_guard = 0;
		if (!upper_guard)
			upper_guard = 63999;
		if (lower_guard<0)
			lower_guard = 0;
		if (upper_guard>63999)
			upper_guard = 63999;
		if (l0<lower_guard || lN>upper_guard)
			return [undefined,'new range ('+l0+','+lN+') exceeds bounds ('+lower_guard+','+upper_guard+')'];
		// setup the mapping from old to new line numbers
		const mapping = new Map<number,number>();
		for (let i=0;i<sel_info.nums.length;i++)
			mapping.set(sel_info.nums[i],l0+i*dl);
		// apply the mapping
		const edits = new Array<vsserv.TextEdit>();
		// Modify primary line numbers only in selected range
		for (let i=0;i<all_info.nums.length;i++)
			if (!ext_sel || lxbase.rangeContainsRange(ext_sel,all_info.rngs[i]))
				this.apply_mapping(i,all_info,mapping,edits);
		// Modify line number references globally
		if (updateRefs) {
			for (let i=0;i<ref_info.nums.length;i++)
				this.apply_mapping(i,ref_info,mapping,edits);
		}
		return [vsserv.TextDocumentEdit.create(doc, edits),''];
	}
	/** Move block of lines past other lines, updating the line numbers
	 * @returns [edit object | undefined , error message]
	 */
	move(doc: vsserv.TextDocumentItem, ext_sel: vsserv.Range, start: string, step: string, updateRefs: boolean):
		[vsserv.TextDocumentEdit | undefined,string] {
		const edits = new Array<vsserv.TextEdit>();
		const all_txt = doc.text;
		const lines = all_txt.split(/\r?\n/);
		let sel_txt = '';
		for (let l = ext_sel.start.line; l <= ext_sel.end.line; l++) {
			sel_txt += lines[l] + '\n';
		}
		const movLines = sel_txt.split(/\r?\n/);
		let syntaxTree = this.parse(sel_txt, "\n");
		const mov_primaries = this.get_primary_nums(syntaxTree);
		const mov_secondaries = this.get_secondary_nums(syntaxTree);
		syntaxTree = this.parse(all_txt, "\n");
		const all_primaries = this.get_primary_nums(syntaxTree);
		const all_secondaries = this.get_secondary_nums(syntaxTree);
		const l0 = parseInt(start);
		const dl = parseInt(step);
		const lN = l0 + dl * (mov_primaries.nums.length - 1);
		// verify parameters while getting insertPos
		if (isNaN(l0) || isNaN(dl) || l0 < 0 || dl < 1)
			return [undefined,'start and step parameters invalid'];
		if (all_primaries.nums.includes(l0)) {
			return [undefined, 'start line already exists'];
		}
		if (lN > 63999) {
			return [undefined, 'upper bound of 63999 exceeded'];
		}
		let insertPos = vsserv.Position.create(0,0);
		for (let i = 0; i < all_primaries.nums.length; i++) {
			if (all_primaries.nums[i] >= l0 && all_primaries.nums[i] <= lN) {
				return [undefined, 'existing line ' + all_primaries.nums[i] + ' is within proposed range'];
			}
			if (all_primaries.nums[i] < l0) {
				insertPos = vsserv.Position.create(all_primaries.rngs[i].start.line + 1, 0);
				if (i == all_primaries.nums.length - 1 && !all_txt.endsWith("\n")) {
					edits.push(vsserv.TextEdit.insert(insertPos, "\n"));
				}
			}
		}
		// set up mappings
		const lineLabelMapping = new Map<number, number>();
		for (let i = 0; i < mov_primaries.nums.length; i++) {
			lineLabelMapping.set(mov_primaries.nums[i], l0 + i * dl);
		}
		// delete lines
		for (let l = ext_sel.start.line; l <= ext_sel.end.line; l++) {
			const oldRng = vsserv.Range.create(l, 0, l + 1, 0);
			edits.push(vsserv.TextEdit.del(oldRng));
		}
		// insert updated lines
		let i0 = 0;
		let idx = 0;
		for (let l = ext_sel.start.line; l <= ext_sel.end.line; l++) {
			let updatedLine = lines[l];
			if (updatedLine.trim().length > 0) {
				this.logger.log(updatedLine);
				const res = this.next_updated_line(movLines, i0, l-ext_sel.start.line, mov_secondaries, lineLabelMapping);
				if (res) {
					[i0, updatedLine] = res;
				}
				this.logger.log(updatedLine);
				const newLabel = lineLabelMapping.get(mov_primaries.nums[idx]);
				updatedLine = updatedLine.replace(/^[0-9 ]*[0-9]/, newLabel ? newLabel.toString() : '???');
				this.logger.log(updatedLine);
				idx += 1;
			}
			edits.push(vsserv.TextEdit.insert(insertPos, updatedLine + "\n"));
		}
		// update line number references outside the moved block
		const last = lineLabelMapping.get(mov_primaries.nums[mov_primaries.nums.length - 1]);
		if (updateRefs && last) {
			for (let i = 0; i < all_secondaries.nums.length; i++) {
				if (!lxbase.rangeContainsRange(ext_sel,all_secondaries.rngs[i]))
					this.apply_mapping(i, all_secondaries, lineLabelMapping, edits);
			}
		}
		return [vsserv.TextDocumentEdit.create(doc, edits),''];
	}
}
 
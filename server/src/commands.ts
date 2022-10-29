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
	needs_guard(curs: Parser.TreeCursor): boolean {
		const shortStr = curs.nodeText.substring(0, 2).toLowerCase();
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
			if (txt.length > 3 && curs.nodeType=='name_str' || curs.nodeType=='name_int')
				this.workingLine = this.replace_curs(txt.substring(0, 2) + txt.slice(-1), curs);
			if (txt.length > 2 && curs.nodeType != 'name_str' && curs.nodeType != 'name_int') {
				if (!this.needs_guard(curs)) {
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
	
		// Persistent spaces and REM and unquotes
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
				if (tok.type == 'tok_data') {
					const preItems = this.workingLine.substring(0, tok.endPosition.column);
					const items = this.workingLine.substring(tok.endPosition.column, curs.endPosition.column);
					const postData = this.workingLine.substring(curs.endPosition.column);
					this.workingLine = preItems + items.replace(/ /g, this.persistentSpace) + postData;
					return lxbase.WalkerOptions.gotoSibling;
				}
			}
		}
		if (curs.nodeType == 'terminal_str')
			this.workingLine = this.replace_curs(curs.nodeText.trim().replace(/ /g, this.persistentSpace), curs);
		if (curs.nodeType == 'str') {
			let persistentSpaceStr = curs.nodeText.trim().replace(/ /g, this.persistentSpace);
			// check to see if there are trailing nodes at this level or at the statement level, if no, strip the last character
			const next = curs.currentNode().nextSibling;
			if (!next) {
				let parentStatement = curs.currentNode().parent;
				while (parentStatement && parentStatement.type != 'statement')
					parentStatement = parentStatement.parent;
				if (parentStatement && !parentStatement.nextSibling)
					persistentSpaceStr = persistentSpaceStr.substring(0, persistentSpaceStr.length - 1);
			}
			this.workingLine = this.replace_curs(persistentSpaceStr, curs);
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
	tokenize_node(curs: Parser.TreeCursor) : lxbase.WalkerChoice
	{
		// Primary line numbers "tokenized" as 16 bit integers separately
		// because here we require sizeof(new_node_data)<=sizeof(old_node_data)

		// Negative ASCII tokens
		if (curs.nodeType in tokenize_map)
			this.tokenizedLine = this.replace_curs(String.fromCharCode(Object(tokenize_map)[curs.nodeType] as number),curs);
		
		// Required upper case
		if (curs.nodeType.substring(0,5)=='name_' || curs.nodeType=='real')
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
				if (tok.type=='tok_data')
				{
					const preItems = this.tokenizedLine.substring(0,tok.endPosition.column);
					const items = this.tokenizedLine.substring(tok.endPosition.column,curs.endPosition.column);
					const postData = this.tokenizedLine.substring(curs.endPosition.column);
					this.tokenizedLine = preItems + items.replace(/ /g,this.persistentSpace) + postData;
					this.tokenizedLine = this.replace_node(String.fromCharCode(Object(tokenize_map)['tok_data'] as number),tok);
					return lxbase.WalkerOptions.gotoSibling;
				}
			}
		}
		if (curs.nodeType=='str')
			this.tokenizedLine = this.replace_curs(curs.nodeText.trim().replace(/ /g,this.persistentSpace),curs);
		if (curs.nodeType=='terminal_str')
			this.tokenizedLine = this.replace_curs(curs.nodeText.trimStart().replace(/ /g,this.persistentSpace),curs);
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
		const linenum = parseInt(this.tokenizedLine.replace(/ /g,''),10);
		const statements = this.tokenizedLine.
			replace(/[0-9 ]+/,'').
			trimEnd().
			replace(/ /g,'').
			replace(RegExp(this.persistentSpace,'g'),' ');
		this.currAddr += statements.length + 5;
		this.tokenizedLine = this.encode_int16(this.currAddr) + this.encode_int16(linenum) + statements + String.fromCharCode(0);
		this.tokenizedProgram += this.tokenizedLine;
		return lxbase.WalkerOptions.gotoSibling;
	}
	tokenize(program: string,baseAddr: number) : string
	{
		const syntaxTree = this.parse(program, '\n');
		this.tokenizedProgram = "";
		this.currAddr = baseAddr;
		this.walk(syntaxTree,this.tokenize_line.bind(this));
		this.tokenizedProgram += String.fromCharCode(0) + String.fromCharCode(0);
		return this.tokenizedProgram;
	}
	detokenize(img: number[]) : string
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
}

export class LineNumberTool extends lxbase.LangExtBase
{
	nums = new Array<number>();
	rngs = new Array<vsserv.Range>();
	leading_space = new Array<number>();
	trailing_space = new Array<number>();
	clear()
	{
		this.nums = new Array<number>();
		this.rngs = new Array<vsserv.Range>();
		this.leading_space = new Array<number>();
		this.trailing_space = new Array<number>();
	}
	push_linenum(curs: Parser.TreeCursor)
	{
		const rng = lxbase.curs_to_range(curs);
		const leading = curs.nodeText.length - curs.nodeText.trimLeft().length;
		const trailing = curs.nodeText.length - curs.nodeText.trimRight().length;
		const parsed = parseInt(curs.nodeText.replace(/ /g,''));
		if (!isNaN(parsed))
		{
			this.nums.push(parsed);
			this.rngs.push(rng);
			this.leading_space.push(leading);
			this.trailing_space.push(trailing);
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
	get_primary_nums(tree: Parser.Tree) : Array<number>
	{
		this.clear();
		this.walk(tree,this.visitPrimaryLineNumber.bind(this));
		return this.nums;
	}
	apply_mapping(i: number,mapping: Map<number,number>,edits: Array<vsserv.TextEdit>)
	{
		const new_num =  mapping.get(this.nums[i]);
		if (new_num!=undefined)
		{
			let fmt_num = ' '.repeat(this.leading_space[i]);
			fmt_num += new_num.toString();
			fmt_num += ' '.repeat(this.trailing_space[i]);
			edits.push(vsserv.TextEdit.replace(this.rngs[i], fmt_num));
		}
	}
	renumber(doc: vsserv.TextDocumentItem, ext_sel: vsserv.Range | null, start: string, step: string, updateRefs: boolean):
		[vsserv.TextDocumentEdit | undefined,string]
	{
		const l0 = parseInt(start);
		const dl = parseInt(step);
		if (isNaN(l0) || isNaN(dl) || l0<0 || dl<1)
			return [undefined,'start and step parameters invalid'];
		let lower_guard = undefined;
		let upper_guard = undefined;
		let txt = doc.text;
		const lines = txt.split('\n');
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
			txt = '';
			for (l = ext_sel.start.line; l <= ext_sel.end.line; l++)
				txt += lines[l] + '\n';
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
			return [undefined,'new range ('+l0+','+lN+') exceeds bounds ('+lower_guard+','+upper_guard+')'];
		// setup the mapping from old to new line numbers
		const mapping = new Map<number,number>();
		for (let i=0;i<line_numbers.length;i++)
			mapping.set(line_numbers[i],l0+i*dl);
		// apply the mapping
		const edits = new Array<vsserv.TextEdit>();
		txt = doc.text;
		syntaxTree = this.parse(txt, "\n");
		// Modify primary line numbers only in selected range
		this.clear();
		this.walk(syntaxTree,this.visitPrimaryLineNumber.bind(this));
		for (let i=0;i<this.nums.length;i++)
			if (ext_sel==undefined || lxbase.rangeContainsRange(ext_sel,this.rngs[i]))
				this.apply_mapping(i,mapping,edits);
		// Modify line number references globally
		if (updateRefs)
		{
			this.clear();
			this.walk(syntaxTree,this.visitSecondaryLineNumber.bind(this));
			for (let i=0;i<this.nums.length;i++)
				this.apply_mapping(i,mapping,edits);
		}
		return [vsserv.TextDocumentEdit.create(doc, edits),''];
	}
}

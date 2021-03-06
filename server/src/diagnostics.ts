import * as vsserv from 'vscode-languageserver/node';
import * as vsdoc from 'vscode-languageserver-textdocument';
import Parser from 'web-tree-sitter';
import * as lxbase from './langExtBase';
import * as server from './server';

// Warn against long name variables with same first two characters
class VariableNameSentry
{
	shortToLong = new Map<string,Set<string>>();

	add(longkey: string,rng: vsserv.Range,diag: Array<vsserv.Diagnostic>)
	{
		const colliding : Array<string> = [];
		const idx = longkey.search(/\W/);
		if (idx>=2 || (idx==-1 && longkey.length>=2))
		{
			const shortKey = longkey.substring(0, 2) + (idx == -1 ? '' : longkey.substring(idx));
			const longSet = this.shortToLong.get(shortKey);
			if (longSet)
			{
				longSet.add(longkey);
				for (const value of longSet)
					colliding.push(value);
			}
			else
			{
				this.shortToLong.set(shortKey,new Set([longkey]));
			}
		}
		if (colliding.length>1)
		{
			let s = "variable name collision:\n";
			for (const c of colliding)
				s += c + ",";
			diag.push(vsserv.Diagnostic.create(rng, s.substring(0,s.length-1), vsserv.DiagnosticSeverity.Warning));
		}
	}
}

export class TSDiagnosticProvider extends lxbase.LangExtBase
{
	workingSymbols = new server.DocSymbols();
	diag = new Array<vsserv.Diagnostic>();
	vsentry = new VariableNameSentry();
	fsentry = new VariableNameSentry();
	lastGoodLineNumber = -1;
	num(node: Parser.SyntaxNode): number
	{
		return parseInt(node.text.replace(/ /g, ''));
	}
	value_range(diag: Array<vsserv.Diagnostic>,node: Parser.SyntaxNode,low:number,high:number)
	{
		if (node.type!="int" && node.type!="real")
			return;
		const rng = lxbase.node_to_range(node);
		const parsed = parseFloat(node.text);
		if (!isNaN(parsed))
			if (parsed<low || parsed>high)
				diag.push(vsserv.Diagnostic.create(rng,'Out of range ('+low+','+high+')'));
	}
	is_error_inside(node: Parser.SyntaxNode): boolean
	{
		let child = node.firstChild;
		if (child)
		{
			do
			{
				if (child.hasError())
					return true;
				child = child.nextNamedSibling;
			} while (child);
		}
		return false;
	}
	process_variable_def(node: Parser.SyntaxNode | null, dim: boolean)
	{
		if (!node)
			return;
		const keyname = lxbase.var_to_key(node);
		const map = keyname.slice(-1) == ')' ? this.workingSymbols.arrays : this.workingSymbols.scalars;
		let varInfo = map.get(keyname);
		if (!varInfo)
			varInfo = { dec: [], def: [], ref: [] };
		if (dim)
			varInfo.dec.push(lxbase.name_range(node));
		else
			varInfo.def.push(lxbase.name_range(node));
		map.set(keyname, varInfo);
	}
	visit_primaries(curs: Parser.TreeCursor): lxbase.WalkerChoice
	{
		const parent = curs.currentNode().parent;
		const rng = lxbase.curs_to_range(curs);
		if (curs.currentNode().hasError())
			return lxbase.WalkerOptions.gotoSibling;
		if (curs.nodeType == "linenum" && parent && parent.type == "line") {
			let nextStatement = curs.currentNode().nextNamedSibling;
			let remark: string | undefined;
			while (nextStatement) {
				if (nextStatement.firstNamedChild?.type == "tok_rem")
					remark = nextStatement.firstNamedChild.nextNamedSibling?.text;
				nextStatement = nextStatement.nextNamedSibling;
			}
			const num = this.num(curs.currentNode());
			if (num < 0 || num > 63999)
				this.diag.push(vsserv.Diagnostic.create(rng, 'Out of range (0,63999)'));
			else if (num <= this.lastGoodLineNumber)
				this.diag.push(vsserv.Diagnostic.create(rng, "Line number out of order"));
			else {
				this.workingSymbols.lines.set(num, {
					rem: remark,
					primary: rng,
					gosubs: new Array<vsserv.Range>(),
					gotos: new Array<vsserv.Range>()
				});
				this.lastGoodLineNumber = num;
			}
			return lxbase.WalkerOptions.gotoSibling;
		}
		else if (curs.nodeType == "tok_dim")
			return lxbase.WalkerOptions.gotoSibling; // goto dim_item
		else if (curs.nodeType == "dim_item") {
			this.process_variable_def(curs.currentNode().firstNamedChild,true);
			return lxbase.WalkerOptions.gotoSibling;
		}
		else if (curs.nodeType == "tok_def") {
			const nameNode = curs.currentNode().nextNamedSibling?.nextNamedSibling;
			if (nameNode) {
				const nameRange = lxbase.node_to_range(nameNode);
				const keyname = lxbase.var_to_key(nameNode);
				if (this.workingSymbols.functions.has(keyname)) {
					this.diag.push(vsserv.Diagnostic.create(nameRange, 'function is redefined'));
				}
				else {
					this.workingSymbols.functions.set(keyname, { dec: [], def: [nameRange], ref: [] });
				}
				return lxbase.WalkerOptions.gotoParentSibling;
			}
		}
		else if (curs.nodeType == "assignment") {
			let next = curs.currentNode().firstNamedChild;
			if (next && next.type == 'tok_let')
				next = next.nextNamedSibling;
			if (next && next.type.substring(0, 4) == 'var_')
				this.process_variable_def(next,false);
		}
		else if (curs.nodeType == "line" || (parent && parent.type == "line"))
			return lxbase.WalkerOptions.gotoChild;
		
		return lxbase.WalkerOptions.gotoParentSibling;
	}
	process_linenum_ref(curs: Parser.TreeCursor, is_sub: boolean): lxbase.WalkerChoice
	{
		let next : Parser.SyntaxNode | null = curs.currentNode();
		if (next.type != "linenum") // we might start on GOSUB node
			next = next.nextNamedSibling;
		while (next && next.type == "linenum") {
			const rng = lxbase.node_to_range(next);
			const num = this.num(next);
			const line = this.workingSymbols.lines.get(num);
			if (line) {
				const ranges = is_sub ? line.gosubs : line.gotos;
				ranges.push(rng);
			}
			else
				this.diag.push(vsserv.Diagnostic.create(rng,'Line does not exist'));
			next = next.nextNamedSibling;
		}
		return lxbase.WalkerOptions.gotoParentSibling;
	}
	process_variable_ref(curs: Parser.TreeCursor): lxbase.WalkerChoice
	{
		const keyname = lxbase.var_to_key(curs.currentNode());
		const nameRange = lxbase.name_range(curs.currentNode());
		const isArray = keyname.slice(-1) == ')';
		if (this.config.warn.collisions)
			this.vsentry.add(keyname, nameRange, this.diag);
		const map = isArray ? this.workingSymbols.arrays : this.workingSymbols.scalars;
		const varInfo = map.get(keyname);
		if (!varInfo && isArray || varInfo && varInfo.dec.length==0 && isArray)
			this.diag.push(vsserv.Diagnostic.create(nameRange, "array is never DIM'd", vsserv.DiagnosticSeverity.Warning));
		if (!varInfo)
			map.set(keyname, { dec: [], def: [], ref: [nameRange] });
		else
			varInfo.ref.push(nameRange);
		const nameNode = curs.currentNode().firstNamedChild;
		if (nameNode)
			this.check_case(nameNode.text,nameRange);
		return isArray ? lxbase.WalkerOptions.gotoChild : lxbase.WalkerOptions.gotoSibling;
	}
	check_case(txt: string,rng: vsserv.Range)
	{
		if (this.config.case.caseSensitive && txt.toUpperCase() != txt)
			this.diag.push(vsserv.Diagnostic.create(rng, 'settings require upper case'));
	}
	visit_node(curs: Parser.TreeCursor): lxbase.WalkerChoice
	{
		const parent = curs.currentNode().parent;
		const rng = lxbase.curs_to_range(curs);
		if (curs.currentNode().hasError())
		{
			if (!this.is_error_inside(curs.currentNode()))
				this.diag.push(vsserv.Diagnostic.create(rng,'syntax error:\n' + curs.currentNode().toString()));
		}
		if (curs.nodeType.slice(0,4) == "tok_")
			this.check_case(curs.nodeText, rng);
		if (curs.nodeType == "tok_gosub")
			return this.process_linenum_ref(curs, true);
		else if (curs.nodeType == "linenum" && parent && parent.type != "line") // any ref that is not GOSUB
			return this.process_linenum_ref(curs, false);
		else if (curs.nodeType.substring(0,4) == 'var_')
			return this.process_variable_ref(curs);
		else if (curs.nodeType == "name_fn") {
			this.check_case(curs.nodeText, rng);
			const keyname = lxbase.var_to_key(curs.currentNode());
			if (this.config.warn.collisions)
				this.fsentry.add(keyname, rng, this.diag);
			const varInfo = this.workingSymbols.functions.get(keyname);
			if (varInfo) {
				varInfo.ref.push(rng);
			} else {
				this.workingSymbols.functions.set(keyname, { dec: [], def: [], ref: [rng] });
				if (parent && parent.type == "fcall")
					this.diag.push(vsserv.Diagnostic.create(rng, 'function never defined'));
			}
		}
		else if (curs.nodeType == "real")
			this.check_case(curs.nodeText, rng);
		else if (curs.nodeType=="line")
		{
			if (curs.currentNode().text.trimEnd().length>239)
				this.diag.push(vsserv.Diagnostic.create(rng,'Maximum length of a line is 239'));
		}
		else if (curs.nodeType=="assignment")
		{
			const lhs = curs.currentNode().firstNamedChild;
			const rhs = curs.currentNode().lastNamedChild;
			if (lhs && rhs)
			{
				if (lhs.type=="var_real" && rhs.type=="real")
					this.value_range(this.diag,rhs,-1e38,1e38);
				if (lhs.type=="var_int" && (rhs.type=="real" || rhs.type=="int"))
					this.value_range(this.diag,rhs,-32767,32767);
			}
		}
		else if (curs.nodeType=="tok_poke")
		{
			const addr = curs.currentNode().nextNamedSibling;
			if (addr)
			{
				this.value_range(this.diag,addr,-32767,65535);
				const byte = addr.nextNamedSibling;
				if (byte)
					this.value_range(this.diag,byte,0,255);
			}
		}
		else if (curs.nodeType=="tok_peek")
		{
			const addr = curs.currentNode().nextNamedSibling;
			if (addr)
				this.value_range(this.diag,addr,-32767,65535);
		}
		else if (["tok_call","tok_himem","tok_lomem"].indexOf(curs.nodeType)>-1)
		{
			const addr = curs.currentNode().nextNamedSibling;
			if (addr)
				this.value_range(this.diag,addr,-32767,65535);
		}
		else if (["tok_coloreq","tok_speedeq"].indexOf(curs.nodeType)>-1)
		{
			const byte = curs.currentNode().nextNamedSibling;
			if (byte)
				this.value_range(this.diag,byte,0,255);
		}
		else if (curs.nodeType=="tok_hcoloreq")
		{
			const v = curs.currentNode().nextNamedSibling;
			if (v)
				this.value_range(this.diag,v,0,7);
		}
		else if (curs.nodeType=="tok_wait")
		{
			const addr = curs.currentNode().nextNamedSibling;
			if (addr)
			{
				this.value_range(this.diag,addr,-32767,65535);
				const mask = addr.nextNamedSibling;
				if (mask)
				{
					this.value_range(this.diag,mask,0,255);
					const val = mask.nextNamedSibling;
					if (val)
						this.value_range(this.diag,val,0,255);
				}
			}
		}
		else if (curs.nodeType=="data_literal") // perhaps parser should handle this
		{
			const data_st = curs.currentNode().parent;
			if (data_st)
			{
				const sib = data_st.nextSibling;
				if (sib)
				{
					if (sib.text.trim()==":" && (curs.nodeText.split('"').length-1)%2 == 1)
						this.diag.push(vsserv.Diagnostic.create(rng,"Odd quote parity in literal on multi-statement line invites trouble.",vsserv.DiagnosticSeverity.Warning));
				}
			}
		}
		else if (curs.nodeType=="terminal_str" && this.config.warn.terminalString)
		{
			this.diag.push(vsserv.Diagnostic.create(rng,"Unquote missing. This is valid if it is intended.",vsserv.DiagnosticSeverity.Warning));
		}
		return lxbase.WalkerOptions.gotoChild;
	}
	update(document : vsdoc.TextDocument): Array<vsserv.Diagnostic>
	{
		this.diag = new Array<vsserv.Diagnostic>();
		if (document && document.languageId=='applesoft')
		{
			this.vsentry = new VariableNameSentry();
			this.fsentry = new VariableNameSentry();
			this.workingSymbols = new server.DocSymbols();
			this.lastGoodLineNumber = -1;
			const syntaxTree = this.parse(document.getText(),"\n");
			this.walk(syntaxTree, this.visit_primaries.bind(this));
			this.walk(syntaxTree, this.visit_node.bind(this));
		}
		return this.diag;
	}
}
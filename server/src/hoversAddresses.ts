import { assert } from 'console';
import * as vsserv from 'vscode-languageserver/node';
import * as specialAddresses from './specialAddresses.json';

export class AddressHovers
{
	amap: Map<number,Array<vsserv.MarkupContent>>;

	get(addr:number) : Array<vsserv.MarkupContent> | undefined
	{
		return this.amap.get(addr);
	}

	add(addr_str: string, addr_base: number,offset: number)
	{
		const offset_names = Object({
			"word" : ["low byte","high byte"] , "vector" : ["opcode","low addr","high addr"],
			"float" : [..."12345"], "unpacked float": [..."123456"]
		});
		const addr = addr_base + offset;
		const addr_unsigned = addr < 0 ? addr + 2**16 : addr;
		const addr_signed = addr_unsigned - 2**16;
		const addr_hex = addr_unsigned.toString(16).toUpperCase();
		const ans = new Array<vsserv.MarkupContent>();
		const obj = Object(specialAddresses)[addr_str];
		if (obj.label)
			ans.push({ kind: 'markdown', value: '`' + obj.label + '`' });
		let addr_type = obj.type;
		if (offset_names[addr_type])
			addr_type += ", " + offset_names[addr_type][offset];
		if (addr_unsigned>=2**15)
			ans.push({ kind: 'markdown', value: 'Special address: **' + addr_type + '** (' + addr_unsigned + ' | ' + addr_signed + ' | $' + addr_hex + ')' });
		else
			ans.push({ kind: 'markdown', value: 'Special address: **' + addr_type + '** (' + addr_unsigned + ' | $' + addr_hex + ')' });
		ans.push({ kind: 'markdown', value: obj.desc });
		if (obj.ctx)
			ans.push({ kind: 'markdown', value: 'Context limitation: ' + obj.ctx });
		if (obj.note)
			ans.push({ kind: 'markdown', value: 'Note: ' + obj.note });
		this.amap.set(addr, ans);
	}
	
	constructor()
	{
		this.amap = new Map<number,Array<vsserv.MarkupContent>>();
		
		for (const property in specialAddresses)
		{
			let addr = parseInt(property);
			if (!isNaN(addr))
			{
				addr = addr >= 2**15 ? addr - 2**16 : addr;
				assert(Math.abs(addr)<2**15,"bad address found in database");
				const typ = Object(specialAddresses)[property].type;
				this.add(property,addr,0);
				if (typ=="word")
					this.add(property,addr,1);
				if (typ=="vector")
					[1,2].forEach( n => this.add(property,addr,n) );
				if (typ=="float")
					[1,2,3,4].forEach( n => this.add(property,addr,n) );
				if (typ=="unpacked float")
					[1,2,3,4,5].forEach( n => this.add(property,addr,n) );
			}
		}
	}
}
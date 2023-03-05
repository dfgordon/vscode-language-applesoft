// These are the settings used in the VSCode client.
// Not all are useful to the server.

export interface applesoftSettings {
	case: {
		caseSensitive: boolean,
		lowerCaseCompletions: boolean
	},
	warn: {
		terminalString: boolean,
		collisions: boolean,
		undeclaredArrays: boolean,
		undefinedVariables: boolean,
		run: boolean
	},
	hovers: {
		specialAddresses: boolean,
		keywords: boolean
	},
	completions: {
		negativeAddresses: boolean
	},
	vii: {
		newMachine: string,
		speed: string,
		color: boolean
	},
	detokenizer: {
		escapes: number[]
	}
	trace: {
		server: string
	}
}

export const defaultSettings: applesoftSettings = {
	case: {
		caseSensitive: false,
		lowerCaseCompletions: true
	},
	warn: {
		terminalString: true,
		collisions: true,
		undeclaredArrays: true,
		undefinedVariables: true,
		run: true
	},
	hovers: {
		specialAddresses: true,
		keywords: true
	},
	completions: {
		negativeAddresses: false
	},
	vii: {
		newMachine: "appleiie",
		speed: "maximum",
		color: false
	},
	detokenizer: {
		escapes: [10,13]
	},
	trace: {
		server: "verbose"
	}
};
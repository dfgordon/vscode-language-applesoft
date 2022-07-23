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
	trace: {
		server: "verbose"
	}
};
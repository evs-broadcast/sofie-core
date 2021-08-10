export enum RundownViewKbdShortcuts {
	RUNDOWN_TAKE = 'f12',
	RUNDOWN_TAKE2 = 'enter', // is only going to use the rightmost enter key for take
	RUNDOWN_HOLD = 'h',
	RUNDOWN_UNDO_HOLD = 'shift+h',
	RUNDOWN_ACTIVATE = '§',
	RUNDOWN_ACTIVATE2 = '\\',
	RUNDOWN_ACTIVATE3 = '|',
	RUNDOWN_ACTIVATE_REHEARSAL = 'mod+§',
	RUNDOWN_DEACTIVATE = 'mod+shift+§',
	RUNDOWN_GO_TO_LIVE = 'mod+home',
	RUNDOWN_REWIND_SEGMENTS = 'shift+home',
	RUNDOWN_RESET_RUNDOWN = 'mod+shift+f12',
	RUNDOWN_RESET_RUNDOWN2 = 'mod+shift+enter',
	RUNDOWN_TOGGLE_SHELF = 'tab',
	ADLIB_QUEUE_MODIFIER = 'shift',
	RUNDOWN_NEXT_FORWARD = 'f9',
	RUNDOWN_NEXT_DOWN = 'f10',
	RUNDOWN_NEXT_BACK = 'shift+f9',
	RUNDOWN_NEXT_UP = 'shift+f10',
	RUNDOWN_DISABLE_NEXT_ELEMENT = 'g',
	RUNDOWN_UNDO_DISABLE_NEXT_ELEMENT = 'shift+g',
	RUNDOWN_LOG_ERROR = 'backspace',
	SHOW_CURRENT_SEGMENT_FULL_NONLATCH = '',
	MINISHELF_QUEUE_NEXT_ADLIB = '',
	MINISHELF_QUEUE_PREV_ADLIB = '',
}

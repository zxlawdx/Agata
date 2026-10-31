import {EditorState,Compartment} from '@codemirror/state';
import {EditorView,lineNumbers,highlightActiveLine,keymap} from '@codemirror/view';
import {defaultKeymap,history,historyKeymap,indentWithTab} from '@codemirror/commands';
import {syntaxHighlighting,defaultHighlightStyle,StreamLanguage,indentOnInput,bracketMatching} from '@codemirror/language';
import {searchKeymap,highlightSelectionMatches} from '@codemirror/search';
import {json} from '@codemirror/lang-json';
import {xml} from '@codemirror/lang-xml';
import {kotlin} from '@codemirror/legacy-modes/mode/clike';
window.AgataCodeEditor={create(parent,onChange){
 const language=new Compartment(),editable=new Compartment();
 const view=new EditorView({parent,state:EditorState.create({extensions:[lineNumbers(),highlightActiveLine(),history(),indentOnInput(),bracketMatching(),syntaxHighlighting(defaultHighlightStyle),highlightSelectionMatches(),keymap.of([indentWithTab,...defaultKeymap,...historyKeymap,...searchKeymap]),language.of([]),editable.of(EditorView.editable.of(false)),EditorView.updateListener.of(update=>{if(update.docChanged)onChange(update.state.doc.toString());})]})});
 return {getValue:()=>view.state.doc.toString(),setValue(value,mode,canEdit){view.dispatch({changes:{from:0,to:view.state.doc.length,insert:value},effects:[language.reconfigure(mode==='json'?json():mode==='xml'?xml():mode==='kotlin'?StreamLanguage.define(kotlin):[]),editable.reconfigure([EditorView.editable.of(canEdit),EditorState.readOnly.of(!canEdit)])]});},destroy:()=>view.destroy()};
}};

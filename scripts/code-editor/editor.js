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
 const states=new Map();let activeKey=null;
 const languageMode=mode=>mode==='json'?json():mode==='xml'?xml():mode==='kotlin'?StreamLanguage.define(kotlin):[];
 const permissions=canEdit=>[EditorView.editable.of(canEdit),EditorState.readOnly.of(!canEdit)];
 const state=(value,mode,canEdit)=>EditorState.create({doc:value,extensions:[lineNumbers(),highlightActiveLine(),history(),indentOnInput(),bracketMatching(),syntaxHighlighting(defaultHighlightStyle),highlightSelectionMatches(),keymap.of([indentWithTab,...defaultKeymap,...historyKeymap,...searchKeymap]),language.of(languageMode(mode)),editable.of(permissions(canEdit)),EditorView.updateListener.of(update=>{if(update.docChanged)onChange(update.state.doc.toString());})]});
 const view=new EditorView({parent,state:state('','text',false)});
 return {getValue:()=>view.state.doc.toString(),setValue(value,mode,canEdit,fileKey='default'){
  if(activeKey&&activeKey!==fileKey)states.set(activeKey,view.state);
  const previous=activeKey===fileKey?view.state:states.get(fileKey);
  // Loading/generated text is not an undoable edit. Each file retains its own history.
  if(previous&&previous.doc.toString()===value){view.setState(previous);view.dispatch({effects:[language.reconfigure(languageMode(mode)),editable.reconfigure(permissions(canEdit))]});}
  else view.setState(state(value,mode,canEdit));
  activeKey=fileKey;
 },destroy:()=>{states.clear();view.destroy();}};
}};

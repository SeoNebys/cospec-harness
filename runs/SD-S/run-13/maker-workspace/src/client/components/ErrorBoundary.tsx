import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error:Error,info:ErrorInfo){console.error('Application render failed',error,info.componentStack);}
  render(){return this.state.failed?<main className="empty"><h1>Keepmark needs a fresh start.</h1><p>Reload the page to reopen your library. Your saved bookmarks are still safe.</p><button className="button primary" onClick={()=>location.reload()}>Reload</button></main>:this.props.children;}
}

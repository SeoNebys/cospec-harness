import { Link,Outlet } from 'react-router-dom';import { AppNavigation } from '../components/AppNavigation';
export function App(){return <div className="app"><header className="topbar"><Link to="/" className="brand"><span className="brand-mark">K</span><span>Keepmark</span></Link><AppNavigation/></header><main><Outlet/></main><footer>Keep what matters. Find it when it does.</footer></div>}

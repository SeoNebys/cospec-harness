import { NavLink } from 'react-router-dom';
export function AppNavigation(){return <nav aria-label="Collections" className="nav"><NavLink to="/">All bookmarks</NavLink><NavLink to="/favorites">Favorites</NavLink><NavLink to="/read-later">Read later</NavLink><NavLink to="/archived">Archive</NavLink></nav>}

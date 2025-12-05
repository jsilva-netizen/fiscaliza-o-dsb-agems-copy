import Home from './pages/Home';
import Municipios from './pages/Municipios';
import TiposUnidade from './pages/TiposUnidade';
import Checklists from './pages/Checklists';
import NovaFiscalizacao from './pages/NovaFiscalizacao';
import ExecutarFiscalizacao from './pages/ExecutarFiscalizacao';
import AdicionarUnidade from './pages/AdicionarUnidade';


export const PAGES = {
    "Home": Home,
    "Municipios": Municipios,
    "TiposUnidade": TiposUnidade,
    "Checklists": Checklists,
    "NovaFiscalizacao": NovaFiscalizacao,
    "ExecutarFiscalizacao": ExecutarFiscalizacao,
    "AdicionarUnidade": AdicionarUnidade,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};
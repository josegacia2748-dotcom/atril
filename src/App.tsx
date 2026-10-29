import { useEffect, type ReactNode } from "react";
import { useApp, useProfile } from "./lib/store";
import { match, navigate, useRoute } from "./lib/router";
import { Shell } from "./components/Shell";
import { Login } from "./pages/Login";
import { DirectorHome } from "./pages/DirectorHome";
import { MusicianHome } from "./pages/MusicianHome";
import { Upload } from "./pages/Upload";
import { Library } from "./pages/Library";
import { Musicians } from "./pages/Musicians";
import { Settings } from "./pages/Settings";
import { ScorePage } from "./pages/ScorePage";
import { NotFound } from "./pages/NotFound";

function Redirect({ to }: { to: string }) {
  useEffect(() => {
    navigate(to);
  }, [to]);
  return null;
}

export default function App() {
  const app = useApp();
  const profile = useProfile();
  const route = useRoute();

  useEffect(() => {
    document.documentElement.dataset.theme = app.theme;
  }, [app.theme]);

  if (!profile) return <Login />;

  const isDirector = profile.role === "director";
  let page: ReactNode;

  const scoreParams = match(route, "/partitura/:id");
  if (scoreParams) {
    page = <ScorePage id={scoreParams[0]} key={scoreParams[0]} />;
  } else if (route.path === "/") {
    page = isDirector ? <DirectorHome /> : <MusicianHome />;
  } else if (route.path === "/subir") {
    page = isDirector ? <Upload /> : <Redirect to="/" />;
  } else if (route.path === "/biblioteca") {
    page = isDirector ? <Library /> : <Redirect to="/" />;
  } else if (route.path === "/musicos") {
    page = isDirector ? <Musicians /> : <Redirect to="/" />;
  } else if (route.path === "/ajustes") {
    page = <Settings />;
  } else {
    page = <NotFound />;
  }

  return <Shell>{page}</Shell>;
}

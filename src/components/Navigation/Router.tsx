import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

type Route = {
  path: string;
  params?: Record<string, string>;
};

type RouterContextType = {
  currentRoute: Route;
  navigate: (path: string | number, state?: Record<string, string>) => void;
};

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [currentRoute, setCurrentRoute] = useState<Route>(() => {
    const hash = window.location.hash.slice(1);
    const [path, queryString] = hash.split('?');
    const params: Record<string, string> = {};
    if (queryString) {
      new URLSearchParams(queryString).forEach((value, key) => {
        params[key] = value;
      });
    }
    console.log('Router initialized - hash:', window.location.hash, 'path:', path, 'params:', params);
    return { path: path || '/', params };
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      const [path, queryString] = hash.split('?');
      const params: Record<string, string> = {};
      if (queryString) {
        new URLSearchParams(queryString).forEach((value, key) => {
          params[key] = value;
        });
      }
      console.log('Hash changed - hash:', window.location.hash, 'path:', path, 'params:', params);
      setCurrentRoute({ path: path || '/', params });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path: string | number, state?: Record<string, string>) => {
    if (typeof path === 'number') {
      window.history.go(path);
    } else {
      if (state) {
        const queryString = new URLSearchParams(state).toString();
        window.location.hash = `${path}?${queryString}`;
      } else {
        window.location.hash = path;
      }
    }
  };

  return (
    <RouterContext.Provider value={{ currentRoute, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useNavigate() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useNavigate must be used within RouterProvider');
  }
  return context.navigate;
}

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within RouterProvider');
  }
  return context;
}

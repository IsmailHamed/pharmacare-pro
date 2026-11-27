import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initDatabase, setDb } from "./infrastructure/db/connection";

const RootComponent = () => {
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    const setup = async () => {
      try {
        const database = await initDatabase();
        setDb(database); // حقن الاتصال ليصبح متاحاً للـ Repositories
        setIsDbReady(true);
      } catch (error) {
        console.error("فشل الاتصال بقاعدة البيانات:", error);
      }
    };

    setup();
  }, []);

  if (!isDbReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-white font-bold font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p>جاري تحميل النظام وقواعد البيانات...</p>
        </div>
      </div>
    );
  }

  return <App />;
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>,
);


import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="py-6 text-center border-b border-slate-700">
      <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
        StudySensei
      </h1>
      <p className="text-slate-400 mt-2 text-lg">Your Personal AI Tutor</p>
    </header>
  );
};

export default Header;

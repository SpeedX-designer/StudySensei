
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="py-6 text-center text-slate-500 mt-auto border-t border-slate-700">
      <p>&copy; {new Date().getFullYear()} StudySensei. Powered by AI.</p>
    </footer>
  );
};

export default Footer;

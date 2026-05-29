import React from 'react';

interface Props {
  title: string;
}

const ComingSoon: React.FC<Props> = ({ title }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <h1 className="text-xl font-semibold text-blue-900">{title}</h1>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-2">🚧</p>
          <p className="text-xl font-medium text-gray-700">{title}</p>
          <p className="text-sm text-gray-500 mt-2">Coming Soon</p>
        </div>
      </main>
      <footer className="py-4 text-center text-xs text-gray-400">Powered by SJ Innovation AI</footer>
    </div>
  );
};

export default ComingSoon;

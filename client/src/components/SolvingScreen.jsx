import React from 'react';

const SolvingScreen = () => {
  return (
    <div className="fixed inset-0 bg-[var(--color-bg-primary)]/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
      <div className="text-center">
        {/* Ant Animation Container */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          {/* Multiple animated ants */}
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute text-4xl"
              style={{
                left: `${20 + (i * 20)}%`,
                top: `${30 + (i % 2) * 40}%`,
                animation: `antWalk 2s ease-in-out infinite`,
                animationDelay: `${i * 0.3}s`,
                transform: 'translateX(0)',
              }}
            >
              🐜
            </div>
          ))}
          
          {/* Central puzzle grid icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border-2 border-purple-500/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>
        
        {/* Title */}
        <h2 className="text-3xl font-bold text-gradient mb-4">Solving Puzzle</h2>
        <p className="text-[var(--color-text-muted)] text-sm mb-6">
          The algorithm is working hard to find the solution...
        </p>
        
        {/* Loading indicator */}
        <div className="flex items-center justify-center gap-3">
          <div className="spinner" />
          <span className="text-[var(--color-text-secondary)]">Please wait</span>
        </div>
        
        {/* Animated dots */}
        <div className="flex justify-center gap-2 mt-6">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[var(--color-primary)]"
              style={{
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`
              }}
            />
          ))}
        </div>
      </div>
      
      <style>{`
        @keyframes antWalk {
          0% {
            transform: translateX(0) translateY(0) rotate(0deg) scale(1);
            opacity: 0.8;
          }
          25% {
            transform: translateX(15px) translateY(-8px) rotate(-8deg) scale(1.1);
            opacity: 1;
          }
          50% {
            transform: translateX(0) translateY(-15px) rotate(0deg) scale(1);
            opacity: 0.9;
          }
          75% {
            transform: translateX(-15px) translateY(-8px) rotate(8deg) scale(1.1);
            opacity: 1;
          }
          100% {
            transform: translateX(0) translateY(0) rotate(0deg) scale(1);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
};

export default SolvingScreen;

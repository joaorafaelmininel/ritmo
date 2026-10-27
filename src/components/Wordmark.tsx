export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-serif tracking-[-0.01em] ${className}`}>
      Nós <span className="italic text-accent">Dois</span>
    </span>
  )
}

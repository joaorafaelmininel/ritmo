export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-serif ${className}`}>
      ritmo<span className="text-accent">.</span>
    </span>
  )
}

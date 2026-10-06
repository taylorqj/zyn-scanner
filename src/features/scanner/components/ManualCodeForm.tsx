import { PlusIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** For cans whose QR code is scratched: the same code is printed next to it. */
export function ManualCodeForm({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setCode('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Scratched QR code? Type the code instead, e.g. 2E4CP98V0"
        aria-label="Reward code"
        autoComplete="off"
        spellCheck={false}
        className="font-mono placeholder:font-sans"
      />
      <Button type="submit" variant="secondary" disabled={!code.trim()}>
        <PlusIcon />
        Add
      </Button>
    </form>
  );
}

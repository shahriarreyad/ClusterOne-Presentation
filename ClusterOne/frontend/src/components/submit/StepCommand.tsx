import { Terminal, Upload, Sparkles } from 'lucide-react'
import type { SubmitJobPayload } from '@/services/jobService'
import { Field } from './Field'

interface StepProps {
  value: SubmitJobPayload
  update: (patch: Partial<SubmitJobPayload>) => void
  errors: Record<string, string>
}

const TEMPLATES = [
  {
    name: 'Bengali NLP Training',
    command: `python train.py \\
  --dataset /datasets/bengali-nlp \\
  --model roberta-base \\
  --epochs 50 \\
  --batch-size 32 \\
  --learning-rate 3e-5 \\
  --output-dir /home/reyad/output/bengali-nlp`,
  },
  {
    name: 'PyTorch Multi-GPU DDP',
    command: `torchrun --nproc_per_node=2 train_ddp.py \\
  --batch-size 64 \\
  --epochs 100 \\
  --data-dir /datasets/imagenet \\
  --precision fp16`,
  },
  {
    name: 'HuggingFace LoRA Fine-tune',
    command: `python fine_tune.py \\
  --model_id meta-llama/Llama-3-8B \\
  --dataset /datasets/instruction-tuning \\
  --lora_r 16 \\
  --lora_alpha 32 \\
  --max_seq_length 2048`,
  },
]

export function StepCommand({ value, update, errors }: StepProps) {

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) update({ command: content })
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-text-secondary">
          Enter the command executed inside the Apptainer container on the physical GPU node.
        </p>

        {/* Upload Script Button */}
        <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors">
          <Upload size={13} />
          <span>Upload Script (.sh / .py)</span>
          <input type="file" accept=".sh,.py,.txt" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>

      {/* Preset templates */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-[11.5px] font-semibold text-text-muted">
          <Sparkles size={12} className="text-accent" />
          Presets:
        </span>
        {TEMPLATES.map((t) => (
          <button
            key={t.name}
            type="button"
            onClick={() => {
              update({ command: t.command })
            }}
            className="rounded-md border border-border/80 bg-surface px-2.5 py-1 text-[11.5px] font-medium text-text-secondary hover:border-accent/40 hover:text-accent transition-colors"
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* Terminal Editor */}
      <Field label="Execution Command / Script" required error={errors.command} hint="Executed on allocated physical cluster hardware. Laptop runs 0% ML workload.">
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-[#070A11] focus-within:border-accent">
          <div className="flex items-center justify-between border-b border-border/60 bg-[#0B0F19] px-3 py-1.5 text-[11px] font-mono text-text-muted">
            <span className="flex items-center gap-1.5">
              <Terminal size={12} className="text-accent" />
              bash container entrypoint
            </span>
            <span>UTF-8</span>
          </div>
          <textarea
            value={value.command}
            onChange={(e) => update({ command: e.target.value })}
            placeholder="python train.py --epochs 50 --batch-size 32 --device cuda"
            rows={8}
            className="w-full bg-transparent p-3.5 font-mono text-[12.5px] leading-relaxed text-[#22D3EE] placeholder:text-text-muted focus:outline-none resize-y"
            spellCheck={false}
          />
        </div>
      </Field>
    </div>
  )
}

import { useRef, useEffect } from 'react'

// Minimal rich-text editor: bold, italic, bullet & numbered lists.
// Stores/returns simple HTML. Uses execCommand which, while deprecated, is
// perfectly adequate for a 3-button editor and needs no dependency.
export default function RichTextEditor({ value, onChange, placeholder }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const exec = (cmd) => {
    document.execCommand(cmd, false, null)
    ref.current?.focus()
    emit()
  }

  const emit = () => {
    onChange?.(ref.current?.innerHTML || '')
  }

  const Btn = ({ cmd, children, title }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault()
        exec(cmd)
      }}
      className="rounded px-2.5 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
    >
      {children}
    </button>
  )

  return (
    <div className="rounded-md border border-slate-300 bg-white shadow-sm focus-within:border-navy-500 focus-within:ring-1 focus-within:ring-navy-500">
      <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-1">
        <Btn cmd="bold" title="Gras">
          <strong>G</strong>
        </Btn>
        <Btn cmd="italic" title="Italique">
          <em>I</em>
        </Btn>
        <span className="mx-1 h-4 w-px bg-slate-200" />
        <Btn cmd="insertUnorderedList" title="Liste à puces">
          • Liste
        </Btn>
        <Btn cmd="insertOrderedList" title="Liste numérotée">
          1. Liste
        </Btn>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={emit}
        data-placeholder={placeholder}
        className="rich-text min-h-[140px] px-3 py-2 text-sm text-slate-900 focus:outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
        suppressContentEditableWarning
      />
    </div>
  )
}

import * as React from "react"

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <select
        className={`flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    )
  }
)

const SelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>
SelectContent.displayName = "SelectContent"

const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => (
  <option value={value}>{children}</option>
)
SelectItem.displayName = "SelectItem"

const SelectTrigger = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ children, ...props }, ref) => <Select ref={ref} {...props}>{children}</Select>
)
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = ({ placeholder }: { placeholder?: string }) => <>{placeholder}</>
SelectValue.displayName = "SelectValue"

Select.displayName = "Select"

export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
}

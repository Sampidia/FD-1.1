"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface RadioGroupProps {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

const RadioGroupContext = React.createContext<{
  value?: string
  onValueChange?: (value: string) => void
}>({})

const RadioGroup: React.FC<RadioGroupProps> = ({
  value,
  onValueChange,
  children,
  className
}) => {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <div className={cn("grid gap-2", className)}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}

interface RadioGroupItemProps {
  value: string
  id?: string
  className?: string
}

const RadioGroupItem: React.FC<RadioGroupItemProps> = ({
  value,
  id,
  className
}) => {
  const { value: selectedValue, onValueChange } = React.useContext(RadioGroupContext)
  const isChecked = selectedValue === value

  return (
    <input
      type="radio"
      value={value}
      checked={isChecked}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onValueChange?.(e.target.value)}
      id={id}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        isChecked && "bg-primary text-primary-foreground",
        className
      )}
    />
  )
}

export { RadioGroup, RadioGroupItem }

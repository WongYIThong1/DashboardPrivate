"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { IconRefresh } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MathCaptchaProps {
  onVerify: (verified: boolean) => void
  disabled?: boolean
}

export function MathCaptcha({ onVerify, disabled }: MathCaptchaProps) {
  const [num1, setNum1] = React.useState(0)
  const [num2, setNum2] = React.useState(0)
  const [operator, setOperator] = React.useState<'+' | '-' | '*'>('+')
  const [userAnswer, setUserAnswer] = React.useState("")
  const [isVerified, setIsVerified] = React.useState(false)
  const [hasMouseActivity, setHasMouseActivity] = React.useState(false)
  const [hasClickedInput, setHasClickedInput] = React.useState(false)
  const [showWarning, setShowWarning] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const generateQuestion = React.useCallback(() => {
    const operators: Array<'+' | '-' | '*'> = ['+', '-', '*']
    const op = operators[Math.floor(Math.random() * operators.length)]
    
    let n1, n2
    if (op === '*') {
      n1 = Math.floor(Math.random() * 10) + 1
      n2 = Math.floor(Math.random() * 10) + 1
    } else if (op === '-') {
      n1 = Math.floor(Math.random() * 20) + 10
      n2 = Math.floor(Math.random() * n1) + 1
    } else {
      n1 = Math.floor(Math.random() * 50) + 1
      n2 = Math.floor(Math.random() * 50) + 1
    }
    
    setNum1(n1)
    setNum2(n2)
    setOperator(op)
    setUserAnswer("")
    setIsVerified(false)
    setHasMouseActivity(false)
    setHasClickedInput(false)
    setShowWarning(false)
    onVerify(false)
  }, [onVerify])

  React.useEffect(() => {
    generateQuestion()
  }, [generateQuestion])

  // Track mouse movement
  React.useEffect(() => {
    const handleMouseMove = () => {
      setHasMouseActivity(true)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const getCorrectAnswer = () => {
    switch (operator) {
      case '+': return num1 + num2
      case '-': return num1 - num2
      case '*': return num1 * num2
      default: return 0
    }
  }

  const handleInputClick = () => {
    setHasClickedInput(true)
  }

  const handleAnswerChange = (value: string) => {
    setUserAnswer(value)
    setShowWarning(false)
    
    if (value.trim() === '') {
      setIsVerified(false)
      onVerify(false)
      return
    }

    const answer = parseInt(value)
    const correct = answer === getCorrectAnswer()
    
    if (correct) {
      // 检查是否有鼠标活动或点击输入框
      // 移动端可能没有鼠标，所以只要有点击就可以
      if (!hasMouseActivity && !hasClickedInput) {
        // 没有人类行为特征
        setShowWarning(true)
        setIsVerified(false)
        onVerify(false)
        
        // 自动刷新题目
        setTimeout(() => {
          generateQuestion()
        }, 2000)
      } else {
        // 验证通过
        setIsVerified(true)
        onVerify(true)
      }
    } else {
      setIsVerified(false)
      onVerify(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="captcha">Verify you&apos;re human</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={generateQuestion}
          disabled={disabled}
          title="Refresh question"
        >
          <IconRefresh className="size-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <div className={cn(
          "flex-1 flex items-center justify-center gap-3 h-11 px-4 rounded-md border bg-background font-mono text-base",
          isVerified && "border-green-500 bg-green-500/5",
          showWarning && "border-orange-500 bg-orange-500/5"
        )}>
          <span className="font-semibold">{num1}</span>
          <span className="text-muted-foreground">{operator}</span>
          <span className="font-semibold">{num2}</span>
          <span className="text-muted-foreground">=</span>
        </div>
        <Input
          ref={inputRef}
          id="captcha"
          type="number"
          placeholder="?"
          value={userAnswer}
          onChange={(e) => handleAnswerChange(e.target.value)}
          onClick={handleInputClick}
          onFocus={handleInputClick}
          disabled={disabled}
          className={cn(
            "w-20 text-center",
            isVerified && "border-green-500",
            showWarning && "border-orange-500"
          )}
          required
        />
      </div>
      {isVerified && (
        <p className="text-xs text-green-600 dark:text-green-500 flex items-center gap-1">
          <svg className="size-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Verified
        </p>
      )}
      {showWarning && (
        <p className="text-xs text-orange-600 dark:text-orange-500 flex items-center gap-1">
          <svg className="size-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Please interact with the page naturally
        </p>
      )}
    </div>
  )
}

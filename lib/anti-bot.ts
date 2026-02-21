// 防机器人检测 - 多层验证

// 1. 时间检测 - 人类填写表单需要时间
export function createTimingChallenge(): { startTime: number } {
  return { startTime: Date.now() }
}

export function validateTimingChallenge(startTime: number, minSeconds: number = 3): boolean {
  const elapsed = (Date.now() - startTime) / 1000
  return elapsed >= minSeconds // 至少需要3秒填写表单
}

// 2. 鼠标移动检测 - 机器人通常不会移动鼠标
let mouseMoveCount = 0
let lastMouseMove = 0
let mouseMovePath: Array<{ x: number; y: number; time: number }> = []
let mouseMoveHandler: ((e: MouseEvent) => void) | null = null

export function trackMouseMovement(): void {
  // 避免重复添加事件监听器
  if (mouseMoveHandler || typeof window === 'undefined') return
  
  mouseMoveHandler = (e: MouseEvent) => {
    const now = Date.now()
    if (now - lastMouseMove > 100) {
      mouseMoveCount++
      lastMouseMove = now
      
      // 记录鼠标轨迹
      mouseMovePath.push({ x: e.clientX, y: e.clientY, time: now })
      
      // 只保留最近50个点
      if (mouseMovePath.length > 50) {
        mouseMovePath.shift()
      }
    }
  }

  window.addEventListener('mousemove', mouseMoveHandler, { passive: true })
}

export function hasMouseMovement(): boolean {
  return mouseMoveCount > 5
}

// 检测鼠标轨迹是否自然（不是直线）
export function hasNaturalMousePath(): boolean {
  if (mouseMovePath.length < 10) return false
  
  // 计算轨迹的方向变化
  let directionChanges = 0
  for (let i = 2; i < mouseMovePath.length; i++) {
    const prev = mouseMovePath[i - 2]
    const curr = mouseMovePath[i - 1]
    const next = mouseMovePath[i]
    
    const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x)
    const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x)
    const angleDiff = Math.abs(angle1 - angle2)
    
    if (angleDiff > 0.3) { // 超过约17度的变化
      directionChanges++
    }
  }
  
  // 自然的鼠标移动应该有多次方向变化
  return directionChanges > 3
}

export function resetMouseTracking(): void {
  mouseMoveCount = 0
  lastMouseMove = 0
  mouseMovePath = []
  
  // 移除事件监听器
  if (mouseMoveHandler && typeof window !== 'undefined') {
    window.removeEventListener('mousemove', mouseMoveHandler)
    mouseMoveHandler = null
  }
}

// 3. 键盘输入检测 - 机器人通常一次性填充所有字段
const inputTimings: Record<string, number[]> = {}
const inputSequence: Array<{ field: string; time: number }> = []

export function trackInputTiming(fieldName: string): void {
  const now = Date.now()
  
  if (!inputTimings[fieldName]) {
    inputTimings[fieldName] = []
  }
  inputTimings[fieldName].push(now)
  
  inputSequence.push({ field: fieldName, time: now })
}

export function hasNaturalInputPattern(): boolean {
  const fields = Object.keys(inputTimings)
  if (fields.length < 2) return false

  // 检查字段之间的切换时间
  if (inputSequence.length > 1) {
    const fieldSwitches = []
    for (let i = 1; i < inputSequence.length; i++) {
      if (inputSequence[i].field !== inputSequence[i - 1].field) {
        const timeDiff = inputSequence[i].time - inputSequence[i - 1].time
        fieldSwitches.push(timeDiff)
      }
    }
    
    // 人类在字段间切换需要时间（至少200ms）
    if (fieldSwitches.some(diff => diff > 200)) {
      return true
    }
  }

  // 检查是否有时间间隔（人类输入会有间隔）
  for (const field of fields) {
    const timings = inputTimings[field]
    if (timings.length > 1) {
      const intervals = []
      for (let i = 1; i < timings.length; i++) {
        intervals.push(timings[i] - timings[i - 1])
      }
      // 如果有任何间隔大于50ms，说明是人类输入
      if (intervals.some(interval => interval > 50)) {
        return true
      }
    }
  }
  return false
}

export function resetInputTracking(): void {
  Object.keys(inputTimings).forEach(key => delete inputTimings[key])
  inputSequence.length = 0
}

// 4. 浏览器指纹 - 简单的环境检测
export function getBrowserFingerprint(): string {
  if (typeof window === 'undefined') return 'server'
  const typedNavigator = navigator as Navigator & { deviceMemory?: number }

  const features = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage,
    navigator.hardwareConcurrency || 0,
    typedNavigator.deviceMemory || 0,
  ]

  return btoa(features.join('|'))
}

// 5. 焦点事件追踪 - 检测用户是否真的在与页面交互
let focusEvents = 0
let blurEvents = 0
let focusHandler: (() => void) | null = null
let blurHandler: (() => void) | null = null

export function trackFocusEvents(): void {
  // 避免重复添加事件监听器
  if (focusHandler || typeof window === 'undefined') return
  
  focusHandler = () => focusEvents++
  blurHandler = () => blurEvents++
  
  window.addEventListener('focus', focusHandler, { passive: true })
  window.addEventListener('blur', blurHandler, { passive: true })
}

export function hasFocusActivity(): boolean {
  return focusEvents > 0 || blurEvents > 0
}

export function resetFocusTracking(): void {
  focusEvents = 0
  blurEvents = 0
  
  // 移除事件监听器
  if (typeof window !== 'undefined') {
    if (focusHandler) {
      window.removeEventListener('focus', focusHandler)
      focusHandler = null
    }
    if (blurHandler) {
      window.removeEventListener('blur', blurHandler)
      blurHandler = null
    }
  }
}

// 6. 综合验证
export interface AntiBotChallenge {
  startTime: number
  fingerprint: string
}

export function createAntiBotChallenge(): AntiBotChallenge {
  trackMouseMovement()
  trackFocusEvents()
  return {
    startTime: Date.now(),
    fingerprint: getBrowserFingerprint(),
  }
}

export function validateAntiBotChallenge(challenge: AntiBotChallenge): { 
  passed: boolean
  reason?: string 
  score: number // 0-100, 越高越可能是人类
} {
  let score = 0
  const reasons: string[] = []

  // 1. 检查时间 (20分)
  const elapsed = (Date.now() - challenge.startTime) / 1000
  if (elapsed >= 2) {
    score += 20
  } else {
    reasons.push('Form submitted too quickly')
  }

  // 2. 检查鼠标移动 (25分)
  const hasMouseActivity = hasMouseMovement()
  const hasNaturalPath = hasNaturalMousePath()
  
  if (hasMouseActivity) {
    score += 15
  }
  if (hasNaturalPath) {
    score += 10
  }
  
  // 3. 检查输入模式 (25分)
  const hasNaturalInput = hasNaturalInputPattern()
  if (hasNaturalInput) {
    score += 25
  } else {
    reasons.push('Unnatural input pattern detected')
  }

  // 4. 检查浏览器指纹 (15分)
  if (challenge.fingerprint !== 'server') {
    score += 15
  } else {
    reasons.push('Invalid browser environment')
  }

  // 5. 检查焦点事件 (15分)
  if (hasFocusActivity()) {
    score += 15
  }

  // 判断是否通过
  const passed = score >= 50 // 至少50分才能通过

  return { 
    passed, 
    reason: passed ? undefined : reasons.join(', '),
    score 
  }
}

export function cleanupAntiBotChallenge(): void {
  resetMouseTracking()
  resetInputTracking()
  resetFocusTracking()
}

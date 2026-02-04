
import React, { InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    error?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', error, ...props }, ref) => {
        return (
            <input
                ref={ref}
                className={`
          w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
          text-white placeholder-white/30 outline-none transition-all
          focus:border-neon-cyan/50 focus:bg-white/10 focus:shadow-[0_0_15px_rgba(0,224,255,0.1)]
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-red-500/50 focus:border-red-500' : ''}
          ${className}
        `}
                {...props}
            />
        );
    }
);

Input.displayName = 'Input';

export default Input;

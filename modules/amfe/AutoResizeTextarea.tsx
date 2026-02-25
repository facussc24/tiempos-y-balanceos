import React, { useEffect, useRef } from 'react';

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: string | number;
}

const AutoResizeTextarea: React.FC<Props> = ({ value, className, ...props }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            className={`${className} overflow-hidden resize-none box-border block`}
            rows={1}
            {...props}
        />
    );
};

export default AutoResizeTextarea;

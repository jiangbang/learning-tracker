import { useQuery } from '@tanstack/react-query';
import { getCalendarData } from '../api';

interface CalendarViewProps {
  goalId: number;
  month?: string;
}

export default function CalendarView({ goalId, month }: CalendarViewProps) {
  const currentMonth = month || new Date().toISOString().slice(0, 7);
  
  const { data, isLoading } = useQuery({
    queryKey: ['calendar', goalId, currentMonth],
    queryFn: () => getCalendarData(goalId, currentMonth),
  });

  if (isLoading) {
    return <div className="text-center py-4 text-gray-500">加载中...</div>;
  }

  if (!data) {
    return <div className="text-center py-4 text-gray-500">暂无数据</div>;
  }

  const days = data.days;
  const [year, monthNum] = currentMonth.split('-').map(Number);
  const firstDay = new Date(year, monthNum - 1, 1).getDay();
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // 周一为第一天

  const maxHours = Math.max(...days.map(d => d.hours), 1);

  const getColorClass = (hours: number) => {
    if (hours === 0) return 'bg-gray-100';
    const ratio = hours / maxHours;
    if (ratio >= 0.8) return 'bg-blue-600';
    if (ratio >= 0.6) return 'bg-blue-500';
    if (ratio >= 0.4) return 'bg-blue-400';
    if (ratio >= 0.2) return 'bg-blue-300';
    return 'bg-blue-200';
  };

  return (
    <div className="p-4">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['一', '二', '三', '四', '五', '六', '日'].map(day => (
          <div key={day} className="text-center text-xs text-gray-500 font-medium py-1">
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: adjustedFirstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        
        {days.map((day) => {
          const dayDate = new Date(day.date);
          const dayNum = dayDate.getDate();
          
          return (
            <div
              key={day.date}
              className={`aspect-square rounded-md flex flex-col items-center justify-center ${getColorClass(day.hours)} transition-colors`}
              title={`${day.date}: ${day.hours}小时`}
            >
              <span className={`text-xs ${day.hours > 0 ? 'text-white' : 'text-gray-400'}`}>
                {dayNum}
              </span>
              {day.hours > 0 && (
                <span className="text-xs text-white font-medium">{day.hours}</span>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <span>少</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 bg-gray-100 rounded" />
          <div className="w-4 h-4 bg-blue-200 rounded" />
          <div className="w-4 h-4 bg-blue-300 rounded" />
          <div className="w-4 h-4 bg-blue-400 rounded" />
          <div className="w-4 h-4 bg-blue-500 rounded" />
          <div className="w-4 h-4 bg-blue-600 rounded" />
        </div>
        <span>多</span>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { ChevronDown, ScanSearch, Copy, ClipboardList, MailCheck, Bot } from 'lucide-react';
import { documentIntelligenceTeam, BMAgent } from './agentTeamConfig';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ScanSearch, Copy, ClipboardList, MailCheck,
};

const AgentCard: React.FC<{ agent: BMAgent }> = ({ agent }) => {
  const Icon = iconMap[agent.icon] ?? Bot;
  const isActive = agent.status === 'active';
  return (
    <div className="min-w-[260px] max-w-[280px] flex-1 bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white shadow"
          style={{ background: 'linear-gradient(135deg, hsl(210 85% 45%), hsl(230 90% 55%))' }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-gray-900 leading-tight">{agent.name}</p>
        </div>
      </div>
      <p className="text-xs text-gray-600 mt-2 line-clamp-2 flex-1">{agent.description}</p>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-xs text-gray-600 capitalize">{agent.status}</span>
        </div>
        <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
          {agent.tasksCompleted} tasks
        </span>
      </div>
    </div>
  );
};

const AgentTeamBanner: React.FC = () => {
  const [expanded, setExpanded] = useState(true);
  const team = documentIntelligenceTeam;

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 border-b-4 ${team.accentColor} mb-4 overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex -space-x-2 shrink-0">
            {team.agents.map((a, i) => {
              const Icon = iconMap[a.icon] ?? Bot;
              return (
                <div
                  key={a.slug}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white border-2 border-white shadow"
                  style={{
                    background: `linear-gradient(135deg, hsl(${210 + i * 5} 85% ${50 - i * 3}%), hsl(${230 + i * 5} 90% ${55 - i * 3}%))`,
                    zIndex: 10 - i,
                  }}
                >
                  <Icon className="w-4 h-4" />
                </div>
              );
            })}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{team.name}</p>
            <p className="text-sm text-gray-600 truncate">{team.tagline}</p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {team.agents.map(agent => <AgentCard key={agent.slug} agent={agent} />)}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentTeamBanner;

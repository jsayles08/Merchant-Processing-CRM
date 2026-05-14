import type { CrmData } from "@/lib/types";
import {
  agentOnboardingStatuses,
  merchantOnboardingStatuses,
  recruitStatuses,
} from "@/lib/workflow-constants";

export type ChartDatum = {
  name: string;
  value: number;
};

export type MonthlyWorkflowDatum = {
  month: string;
  recruits: number;
  merchants: number;
};

export function buildStatusSeries(
  values: { status: string }[],
  options: { value: string; label: string }[],
): ChartDatum[] {
  return options.map((option) => ({
    name: option.label,
    value: values.filter((item) => item.status === option.value).length,
  }));
}

export function calculateConversionRate(total: number, converted: number) {
  if (!total) return 0;
  return Math.round((converted / total) * 100);
}

export function calculateAgentOnboardingCompletion(data: CrmData) {
  if (!data.agentOnboardingRecords.length) return 0;

  const completed = data.agentOnboardingRecords.reduce(
    (sum, record) => sum + Number(record.training_progress || 0),
    0,
  );

  return Math.round(completed / data.agentOnboardingRecords.length);
}

export function buildMonthlyWorkflowSeries(data: CrmData, monthCount = 6): MonthlyWorkflowDatum[] {
  const months = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (monthCount - index - 1));
    return {
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString("en-US", { month: "short" }),
    };
  });

  return months.map((month) => ({
    month: month.label,
    recruits: data.agentRecruits.filter((recruit) => recruit.created_at.slice(0, 7) === month.key).length,
    merchants: data.merchantOnboardingRecords.filter((record) => record.created_at.slice(0, 7) === month.key).length,
  }));
}

export function buildWorkflowAnalytics(data: CrmData) {
  const pendingFollowUps = [
    ...data.tasks.filter((task) => task.status !== "completed"),
    ...data.agentRecruits.filter((recruit) => recruit.follow_up_at),
    ...data.merchantOnboardingRecords.filter((record) => record.follow_up_at),
  ].length;
  const activeRecruitPipeline = data.agentRecruits.filter(
    (recruit) => !["active", "rejected"].includes(recruit.status),
  ).length;
  const activeMerchantPipeline = data.merchantOnboardingRecords.filter(
    (record) => !["active", "declined"].includes(record.status),
  ).length;

  return {
    recruitStatus: buildStatusSeries(data.agentRecruits, recruitStatuses),
    agentOnboardingStatus: buildStatusSeries(data.agentOnboardingRecords, agentOnboardingStatuses),
    merchantOnboardingStatus: buildStatusSeries(data.merchantOnboardingRecords, merchantOnboardingStatuses),
    monthlyWorkflow: buildMonthlyWorkflowSeries(data),
    metrics: {
      totalRecruits: data.agentRecruits.length,
      activeRecruitPipeline,
      recruitConversionRate: calculateConversionRate(
        data.agentRecruits.length,
        data.agentRecruits.filter((recruit) => recruit.status === "active").length,
      ),
      agentOnboardingCompletion: calculateAgentOnboardingCompletion(data),
      totalMerchantOnboarding: data.merchantOnboardingRecords.length,
      activeMerchantPipeline,
      merchantConversionRate: calculateConversionRate(
        data.merchantOnboardingRecords.length,
        data.merchantOnboardingRecords.filter((record) => record.status === "active").length,
      ),
      pendingFollowUps,
    },
  };
}

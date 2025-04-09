declare namespace UserRequest {

  export interface SignUp extends Device {
    countryCode: string;
    mobileNo: string;
    email: string;
    fullMobileNo?: string;
    password: string;
    flagCode?: string;
  }

  export interface SendOtp {
    type?: string;
    email?: string;
    countryCode?: string;
    mobileNo?: string;
    userId?: string;
  }

  export interface VerifyOTP extends Device {
    otp: string;
    email?: string;
    countryCode?: string;
    mobileNo?: string;
  }

  export interface Login extends Device {
    email: string;
    password: string;
  }

  export interface ForgotPassword {
    email: string;
  }

  export interface ResetPassword {
    password: string;
    confirmPassword: string;
    email: string;
  }

  export interface ChangePassword {
    password: string;
    confirmPassword: string;
    oldPassword: string;
    hash?: string;
  }

  export interface VerifyUser {
    isApproved: string;
    userId: string;
    reason?: string;
    declinedReason?: string;
  }

  export interface SkipSteps {
    type: string;
  }

  export interface DeleteAccount {
    password: string;
  }

  export interface supportChat {
    message: string;
    type: number;
    userId?: string;
  }

  export interface Setting {
    pushNotificationStatus: boolean;
    groupaNotificationStatus: boolean;
    isProfileHidden: boolean;
  }
  export interface EditProfile {
    email: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    name?: string;
    isProfileCompleted?: boolean;
    countryCode?: string;
    mobileNo?: string;
    flagCode?: string;
  }

  export interface UploadDocument {
    type: string;
    documentUrl: string;
    documentUploadToken?: string;
  }

  export interface UserList extends ListingRequest {
    userType?: string;
    lat?: number;
    lng?: number;
    users?: any[];
    gender?: string;
    categoryIds?: any;
    interestIds?: any;
    activityId?: string;
  }

  export interface NotificationList {
    pageNo: number;
    limit: number;
  }

  export interface ManageNotification {
    pushNotificationStatus: boolean;
    groupaNotificationStatus: boolean;
  }
  export interface NotificationStatus {
    isRead: boolean;
    notificationId: boolean;
  }

  export interface OnboardSuccess {
    userId: string;
  }

  export interface PreSignedUrl {
    filename: "string";
    fileType: "string";
  }

  export interface blockDeleteUser {
    type: string;
    userId: string;
  }

}
